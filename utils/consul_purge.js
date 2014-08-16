var Consul = require('consul-node');

var consul = new Consul();

var kill_entry = function(key) {
  console.log('Deleting %s', key);
  consul.kv.delete(key, function(err) {
    if (err) return console.error(err);
  });
};

console.log('Deleting all keys');
consul.kv.get('?recurse', function (err, items) {
  if (err) return console.error(err);
  
  if (items) {
    items.forEach(function(item) {
      kill_entry(item.key);
    });
  }
});