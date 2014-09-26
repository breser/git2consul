var consul = require('consul')();

var _ = require('underscore');

/* istanbul ignore next */
/**
 * Grab the meta config to bootstrap git2consul.
 */
exports.read = function(path, cb) {
  if (!cb) {
    cb = path;
    path = 'git2consul/config';
  }

  var params = {'key': path};

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
    cb(null, config);
    
  });
};
