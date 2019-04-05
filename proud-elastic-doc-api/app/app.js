'use strict';

global.__base = __dirname + '/';

const express = require('express'),
      cors = require('cors'),
      http = require('http'),
      https = require('https'),
      bodyParser = require('body-parser'),
      basicAuth = require('basic-auth');


global.config = require(__base + 'config');

const app = express();

global.routeAuth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.send(401);
  };

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name ===  process.env.API_AUTH_USER && user.pass === process.env.API_AUTH_PASS) {
    return next();
  } else {
    return unauthorized(res);
  };
};

app.use(cors({
    'methods': ['GET', 'POST']
}));

app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(bodyParser.json()); // for parsing application/json

// Test home route
app.get('/', function(req, res) {
    res.send('Hello');
});

// Init http
const httpServer = http.createServer(app);
httpServer.listen(config.port);

// Init https
if(process.env.SSL_KEY && process.env.SSL_CRT) {
  const credentials = {
    key: process.env.SSL_KEY, 
    cert: process.env.SSL_CRT
  };
  const httpsServer = https.createServer(credentials, app);
  httpsServer.listen(config.https_port);
}

const indexAttach = require('./indexAttach');

app.post('/send-attachments', indexAttach);

module.exports = app;