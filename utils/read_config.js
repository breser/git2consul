
var Consul = require('consul-node');
var consul = new Consul();

/**
 * Grab the meta config to bootstrap git2consul.
 */
module.exports = function(cb) {
  consul.kv.get('/git2consul/?recurse', function(err, items) {
    if (err) return cb(err);
    
    var config = {};
    items.forEach(function(item) {
      config[item.key.substring(11)] = item.value.indexOf(',') === -1 ? item.value : item.value.split(',');
    });
    
    cb(null, config);
  });
};
