'use strict';

const fs = require('fs');
const _ = require('lodash');
const RedisSMQ = require('rsmq')
const request = require('request');

const name = 'proudElastic';

const rsmq = new RedisSMQ( {host: config.redis, port: config.redisport, ns: name} );

const delay = 5;

let processing = false;

/**
 * Build Redis Queue
 */
function createRedisQ() {
  return new Promise((resolve, reject) => {
    rsmq.listQueues( function (err, queues) {
      if ( err ){
        console.error( err )
        reject('Can\'t reach redis.... we\'re screwed');
      }
      else if (!queues.length) {
        rsmq.createQueue({ qname: name, maxsize: -1 }, function (err, resp) {
          if (resp===1) {
            console.log('Queue created' + + queues.join( ',' ));
            resolve();
          }
        });
      } else {
        console.log('Active queues: ' + queues.join( ',' ) )
        resolve();
      }
    });
  });
}

/**
 * Gets a doc from elastic
 */
function getIndexedDoc(task) {
  const path = `${task.indexedPath}?_source_includes=attachments&_source_excludes=*data,*content`;
  
  return getElastic(path)
    .then((result) => {
      if (!result.found || !result._source) {
        return null;
      }
      return result._source;
    });
}

/**
 * Requests doc, encodes to base64
 */
function getEncodedDoc(url) {
  return new Promise((resolve, reject) => {
    const filepath = `${__base}encoding/${url.substring(url.lastIndexOf('/')+1)}`;
    const ws = fs.createWriteStream(filepath);
    // Get file
    request.get(url).pipe(ws);
    // Watch results
    ws.on('error', (error) => {
      console.log('Error saving file');
      return reject(error);
    }).on('finish', () => {
      // Now read our file in base64
      fs.readFile(filepath, { encoding: 'base64'}, (error, data) => {
        if (error) {
          console.log('Error reading file: ' + filepath);
          return reject(error);
        }
        // Now delete
        fs.unlink(filepath, (delErr) => {
          if(delErr) {
            console.log('Error deleting file...sending anyway: ' + filepath);
          }
          return resolve(data);
        });  
      });
    });
  });
}

/**
 * Attaches base64 encoding to post attachments
 * @TODO deal with multple docs?
 */
function attachEncodedDocs(task, indexed) {
  /**
   * Gets the saved attachment data for a given file name
   */
  const getIndexedData = (attachment) => {
    if (!indexed || !indexed.attachments || !indexed.attachments.length) {
      return null;
    }
    return indexed.attachments
      .filter(item => item.file === attachment)
      .reduce((prev, curr) => curr || prev, null);
  };

  return new Promise((resolve, reject) => {
    if (_.has(task, 'post.attachments') && task.post.attachments.length) {
      // Do we even need to post?
      let newAttachment = false;

      // Run through attachments, and either use existing or encode doc
      const promises = task.post.attachments.map((attachment, index) => 
        new Promise((resolveInner) => {
          // Already have this doc?
          const indexedData = getIndexedData(attachment);
          if (indexedData) {
            console.log('Doc already exists in elastic: ' + attachment);
            task.post.attachments[index] = indexedData;
            resolveInner();
            return;
          }

          // Get encoded
          console.log('Fetching and encoding: ' + attachment);
          getEncodedDoc(attachment).then((encoded) => {
            console.log('Encode success: ' + attachment);
            task.post.attachments[index] = { file: attachment, data: encoded };
            // Set flag
            newAttachment = true;
            resolveInner();
          }).catch((error, response) => {
            console.log(error);
            delete task.post.attachments[index];
            resolveInner();
          });
        })
      );

      Promise.all(promises)
        .then(() => {
          if (!newAttachment) {
            // Nothing new
            return reject('Post has no new attachments');
          } else if (!task.post.attachments.length) {
            // Errors occurred
            return reject('After encoding, post no longer has any attachments');
          }
          resolve(task.post);
        })
        .catch((error) => {
          console.log(error);
          reject(error.message);
        });
    } else {
      reject('No attachments');
    }
  });
}

/**
 * Sends to elastic
 */
function getElastic(path) {
  const url = `${config.elasticsearch}:9200/${path}`;

  return new Promise((resolve, reject) => {
    return request({
      method: 'GET',
      uri: url,
      json: true,
    }, function (error, response, body) {
      if (!error && response && response.statusCode === 200) {
        return resolve(body);
      }
      if (error) {
        console.log(error);
      } else {
        console.log(body);
      }
      return reject('Failed getting from elastic');
    });
  });
}

/**
 * Sends to elastic
 */
function sendElastic(path, post) {
  const url = `${config.elasticsearch}:9200/${path}`;
  console.log(`Attemping to index post ID: ${post.ID}, to url: ${url}`);
  
  return new Promise((resolve, reject) => {
    request({
      method: 'PUT',
      uri: url,
      json: true,
      body: post,
    }, function (error, response, body) {
      if (!error && response && response.statusCode === 200) {
        return resolve(body);
      }
      if (error) {
        console.log(error);
      } else {
        console.log(body);
      }
      return reject('Failed sending to elastic');
    });
  });
}

/**
 * Send to the server
 */
function postToElastic(message) {

  console.log('Post to elastic beginning');

  const erroring = (reason) => {
    console.log('Post failed: ' + reason);
    processing = false;
    nextInQueue();
  }

  let task;
  try {
    task = JSON.parse(message.message);
  } catch(e) {
    console.log(e);
    return erroring('Initial parse failed');
  }

  // Run
  getIndexedDoc(task).then((indexed) => {
    attachEncodedDocs(task, indexed).then((post) => {
      sendElastic(task.path, post).then(() => {
        console.log(`Success post ID: ${post.ID}, to path: ${task.path}`);
        processing = false;
        nextInQueue();
      }).catch(erroring);
    }).catch(erroring);
  }).catch((error) => erroring(error.message));
}

/**
 * Run down the queue
 */
function nextInQueue() {
  if (!processing) {
    processing = true;
    rsmq.popMessage({ qname: name }, function (err, message) {
      if ( err ){
        console.log(err);
        processing = false;
        return
      }
      // Queue finished
      if (!message.id) {
        processing = false;
        return
      }
      // List how many remaining
      rsmq.getQueueAttributes({ qname: name }, function (err, resp) {
        if ( err ) {
          return;
        }

        console.log('Queue msgs remaining: ' + resp.msgs);
      });
      // Post it
      postToElastic(message);
    });
  }
}

// Don't index all at once
let postingTimeout = null;


/**
 * Actually send
 */
function processSending(json) {
  return new Promise((resolve, reject) => {
    rsmq.sendMessage({qname: name, message: JSON.stringify(json), delay: (delay - 1) }, function (err, resp) {
        if ( err ) {
          console.error( err )
          return reject(err);
          // Encountered error, try creating index
        } 

        if (resp) {
          clearTimeout(postingTimeout);
          console.log('Message sent. ID:', resp);
          postingTimeout = setTimeout(() => {
            nextInQueue();
          }, (delay * 1000));
        }

        return resolve();
    });
  });
}

/**
 * Try to send, maybe create queue
 */
function sendMessage(json) {
  return new Promise((resolve, reject) => {
    return processSending(json).then(() => {
      resolve();
    }).catch(() => {
      // Nope maybe we don't have queue yet
      return createRedisQ().then(() => {
        // Try again
        return processSending(json).then(() => {
          resolve();
        });
      });
    })
  });
}

/**
 * Express response
 */
const handleRequest = (req, res) => {
  let payload = req.body;
  if (!payload || !payload.path || !_.has(payload, 'post.attachments') || !payload.post.attachments.length) {
    // Well....
    console.log('Insufficient data to index:' + payload.path);
    res.send();
  }

  // Send message
  sendMessage(payload).then(() => {
    res.send();
  }).catch(() => {
    console.log('Failed to index:' + payload.path);
    res.send();
  });
}

module.exports = handleRequest