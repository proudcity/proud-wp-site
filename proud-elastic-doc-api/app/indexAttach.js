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
function attachEncodedDocs(task) {
  return new Promise((resolve, reject) => {
    if (_.has(task, 'post.attachments') && task.post.attachments.length) {
      task.post.attachments.forEach((attachment, index) => {
        console.log('Fetching and encoding: ' + attachment);
        // Get encoded
        getEncodedDoc(attachment).then((encoded) => {
          console.log('Encode success');
          task.post.attachments[index] = { data: encoded };
          resolve(task.post);
        }).catch((error, response) => {
          console.log(error);
          reject('Fetching and encoding failed');
        });
      });
    } else {
      reject('No attachments');
    }
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
      if (body && body.error) {
        console.log(body.error);
      }
      console.log(error);
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
  attachEncodedDocs(task).then((post) => {
    sendElastic(task.path, post).then(() => {
      console.log(`Success post ID: ${post.ID}, to path: ${task.path}`);
      processing = false;
      nextInQueue();
    }).catch((reason) => {
      erroring(reason);
    });
  }).catch((reason) => {
    erroring(reason);
  });
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