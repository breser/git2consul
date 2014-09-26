var _ = require('underscore');
var consul = require('consul')();

console.log('Listing all keys');

var params = {'key': '', recurse: true};

if (process.env.TOKEN) {
  params = _.extend(params, {'token': process.env.TOKEN})
}

consul.kv.get(params, function (err, items, res) {
  if (err) return console.error(err);

  if (items) {
    items.forEach(function(item) {
      console.log(item.Key);
    });
  }
});