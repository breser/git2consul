var util = require('util');

var logger = require('winston');
logger.clear();

require('winston-logstash');

var config_reader = require('./config_reader.js');

module.exports.init = function(cb) {
  
  config_reader.read(function(err, config) {
    
    if (!config.logging || config.logging.length === 0) {
      // If no logging is configured, default to console.
      transports.push(new (logger.transports.Console)());
    } else {
      config.logging.forEach(function(log_type) {      
        var transport_type = log_type.transport;
        if (!transport_type) return console.error('Log configuration %s has no transport type', util.inspect(log_type));
      
        if (!logger.transports[transport_type]) return console.error('Winston does not support transport type %s', transport_type);
      
        // The below could be done on 1 line with {} sent in the no-config case, but this is a hedge against a poorly
        // written Winston transport freaking out if its first param is an empty object.
        if (log_type.config)
          logger.add(logger.transports[transport_type], log_type.config);
        else
          logger.add(logger.transports[transport_type]);
      });
    }
  
    module.exports = logger;
    
    cb();
  });
};