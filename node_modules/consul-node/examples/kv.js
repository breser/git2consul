
var Consul = require('..');
var consul = new Consul();

consul.kv.put('hello', 'world', function (err, ok) {
  if (err) return console.error(err.stack);
  consul.kv.get('hello', function (err, items) {
    if (err) return console.error(err.stack);
    console.log(items);
  });
});
