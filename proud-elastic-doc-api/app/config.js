const _ = require('lodash');

module.exports = {
  'port': _.has(process, 'env.PORT') ? parseInt(process.env.PORT) : 8084,
  'elasticsearch': _.has(process, 'env.ELASTIC') ? `http://${process.env.ELASTIC}` : 'http://localhost',
  'redis': _.has(process, 'env.REDIS') ? process.env.REDIS : 'localhost',
  'redisport': _.has(process, 'env.REDISPORT') ? parseInt(process.env.REDISPORT) : 6379,
}