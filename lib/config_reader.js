var consul = require('consul')({'host': global.endpoint, 'port': global.port, 'secure':global.secure});

var _ = require('underscore');

var logger = require('./logging.js');

/* istanbul ignore next */
/**
 * Grab the meta config to bootstrap git2consul.
 */
exports.read = function(params, cb) {
  if (!cb) {
    cb = params;
    params = {'key': 'git2consul/config'};
  }

  if (global.token) {
    params = _.extend(params, {'token': global.token});
  }

  consul.kv.get(params, function(err, item) {
    if (err) return cb(err);

    try {
      var config = JSON.parse(item.Value);
    } catch(e) {
      return cb('Config value is not valid JSON: ' + require('util').inspect(item));
    }
    cb(null, config, item);
  });
};

/* istanbul ignore next */
/**
 * Wait for the consul config KV to change
 */
exports.wait = function(cb) {
  exports.read(function(err, config, item) {
    if (err) return cb(err);

    var modify_index = item.ModifyIndex;
    logger.info("Current config index is %s, waiting for changes.", modify_index);

    var wait_for_change = function() {
      exports.read({'key': 'git2consul/config', index: item.ModifyIndex}, function(err, config, item) {
        if (err) return cb(err);

        if (modify_index !== item.ModifyIndex) {
          logger.warn("Config changed.");
          return cb(null);
        }

        process.nextTick(wait_for_change);
      });
    };

    process.nextTick(wait_for_change);
  });
};
