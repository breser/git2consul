var Consul = require('consul-node');

var consul = new Consul();

console.log('Listing all keys');
consul.kv.get('?recurse', function (err, items) {
  if (err) return console.error(err);
  
  if (items) {
    items.forEach(function(item) {
      console.log(item.key);
    });
  }
});