var util = require('util');

var bunyan = require('bunyan');

var config_reader = require('./config_reader.js');

module.exports.init = function(cb) {
  
  config_reader.read(function(err, config) {
    
    if (!config.logger) {
      config.logger = {name: 'myapp'};
    }
    
    config.logger.streams.forEach(function(stream) {
      if (stream.stream === "process.stdout") stream.stream = process.stdout;
      else if (stream.stream === "process.stderr") stream.stream = process.stderr;
    });
    
    module.exports = bunyan.createLogger(config.logger);
    
    cb();
  });
};