var fs = require('fs');

var consul = require('consul')();

var _ = require('underscore');

/**
 * This utility adds keys from the top level of a .json config file to the /git2consul/ path of
 * Consul.  We use this to seed Consul's KV with the bootstrapping information used by git2consul.
 */
exports.setConfig = function(path, value, cb) {
  if (!cb) {
    cb = value;
    value = path;
    path = 'git2consul/config';
  }

  var add_entry = function(key, value, cb) {
    console.log('Adding config %s : %s', key, value);

    var params = {'key': key, 'value': value};

    if (process.env.TOKEN) {
      params = _.extend(params, {'token': process.env.TOKEN})
    }

    consul.kv.set(params, cb);
  };

  consul.kv.set(path, config, function(err) {
    if (err) return console.error(err);
    cb();
  });
  
}

if (process.argv.length === 3) {
  var config_file = process.argv[2];

  console.log('Adding %s as consul config', config_file);

  var config = fs.readFileSync(config_file, {'encoding':'utf8'});

  try {
    JSON.parse(config);
  } catch(e) {
    console.error('config_file is not valid JSON');
    process.exit(1);
  }
  
  exports.setConfig(config, function(err) {
    if (err) return console.error("Failed to write config");
  });
}