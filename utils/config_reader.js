
var Consul = require('consul-node');
var consul = new Consul();

/**
 * Grab the meta config to bootstrap git2consul.
 */
exports.read = function(cb) {
  consul.kv.get('/git2consul/config', function(err, items) {
    if (err) return cb(err);
    
    try {
      var config = JSON.parse(items[0].value);
    } catch(e) {
      return cb('Config value is not valid JSON: ' + require('util').inspect(items));
    }
    cb(null, config);
    
  });
};
