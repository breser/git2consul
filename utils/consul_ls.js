var consul = require('consul')();

console.log('Listing all keys');
consul.kv.get({key:'', recurse: true}, function (err, items, res) {
  if (err) return console.error(err);

  if (items) {
    items.forEach(function(item) {
      console.log(item.Key);
    });
  }
});