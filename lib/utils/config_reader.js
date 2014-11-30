var consul = require('consul')();

var _ = require('underscore');

/* istanbul ignore next */
/**
 * Grab the meta config to bootstrap git2consul.
 */
exports.read = function(params, cb) {
  if (!cb) {
    cb = params;
    params = {'key': 'git2consul/config'};
  }

  if (process.env.TOKEN) {
    params = _.extend(params, {'token': process.env.TOKEN})
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

/**
 * Wait for the consul config KV to change
 */
exports.wait = function(path, cb) {

};
