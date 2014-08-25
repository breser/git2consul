var ConsulClass = require('consul-node');
var consul = new ConsulClass();

exports.getValue = function(key, cb) {
  consul.kv.get(key, function(err, value) {
    if (err) return cb(err);
    
    cb(null, value === undefined ? value : value[0].value);
  });
};