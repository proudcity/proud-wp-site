'use strict';

var http = require("http");

var options = {
  "method": "POST",
  "hostname": "localhost",
  "port": "8084",
  "path": "/send-attachments",
  "headers": {
    "content-type": "application/json",
    "cache-control": "no-cache",
    "postman-token": "914f0ce5-8c84-885f-8a4b-ead7e22f4090"
  }
};

var working = false;
function makethecall(json) {
  var req = http.request(options, function (res) {
    var chunks = [];

    res.on("data", function (chunk) {
      console.log('chunking');
      chunks.push(chunk);
    });

    res.on("end", function () {
      var body = Buffer.concat(chunks);
      // console.log(body.toString());
      console.log('done');
      working = false;
    });
  });
  req.write(JSON.stringify(json));
  req.end();
}

function isWorkin() {
  console.log('ummmm');
  return working;
}

var index = 'san-rafael-ca';


var timout = 500;

for(let i = 1; i < 30; i++) {
  var basepath = `${index}/post/${i}`;
      var path = `${index}/post/${i}?pipeline=${index}-attachment`;
  setTimeout(() => {
    const json = { 
      indexedPath: basepath, 
      path: `${basepath}?pipeline=${index}-attachment`,
      post: { 
        ID: i,
        attachments: [ 'https://storage.googleapis.com/proudcity/localhosttest/uploads/2018/11/Awards.pdf', 'https://storage.googleapis.com/proudcity/localhosttest/uploads/text-1-1.docx' ]
      }
    };
    console.log(json);
    makethecall(json);
  }, (timout * i));
}

var timout2 = 500; 

setTimeout(() => {
  for(let i = 1; i < 30; i++) {
    
    setTimeout(() => {
      var basepath = `${index}/post/${i}`;
      var path = `${index}/post/${i}?pipeline=${index}-attachment`;
      const json = { 
        path: path,
        post: { 
          ID: i,
          attachments: [ 'https://storage.googleapis.com/proudcity/localhosttest/uploads/text-1-1.docx' ]
        }
      };
      makethecall(json);
    }, (timout2 * i));

  }
}, timout * 15)