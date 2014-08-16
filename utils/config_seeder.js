var fs = require('fs');

var Consul = require('consul-node');

var consul = new Consul();

/**
 * This utility adds keys from the top level of a .json config file to the /git2consul/ path of
 * Consul.  We use this to seed Consul's KV with the bootstrapping information used by git2consul.
 */

if (process.argv.length !== 3) {
  console.error('usage: node utils/config_seeder.js config.js');
  process.exit(1);
}

var add_entry = function(key, value, cb) {
  console.log('Adding config %s : %s', key, value);
  consul.kv.put(key, value, cb);
};

var config_file = process.argv[2];

console.log('Adding keys from config file %s to local consul cluster', config_file);

var file = fs.readFileSync(config_file, {'encoding':'utf8'});
var obj = JSON.parse(file);
for (var key in obj) {
  var value = obj[key];
  if (typeof value === 'string') {
    add_entry('git2consul/' + key, value, function(err) {
      if (err) return console.error(err);
    });
  } else if (value.hasOwnProperty('length')) {
    value = value.join();
    add_entry('git2consul/' + key, value, function(err) {
      if (err) return console.error(err);
    });
  }
}
