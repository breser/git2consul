var fs = require('fs');

/**
 * First, check if there is a command line override for the consul endpoint.
 * If so, use it to seed the config.
 */

var endpoint = "127.0.0.1";
var port = 8500;
var secure = false;
for (var i=2; i<process.argv.length; ++i) {
    if(process.argv[i] === '-s' || process.argv[i] === '--secure') secure = true;
    if(process.argv[i] === '-e' || process.argv[i] === '--endpoint') {
            if(i+1 >= process.argv.length) {
                    logger.error("No endpoint provided with --endpoint option");
                    process.exit(3);
            }
            endpoint = process.argv[i+1];
    }
    if(process.argv[i] === '-p' || process.argv[i] === '--port') {
      if(i+1 >= process.argv.length) {
        logger.error("No port provided with --port option");
        process.exit(3);
      }
      port = process.argv[i+1];
    }
}

var consul = require('consul')({'host': endpoint, 'port': port, 'secure': secure});

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

  console.log('Adding config %s : %s', path, value);

  var params = {'key': path, 'value': value};

  if (process.env.TOKEN) {
    params = _.extend(params, {'token': process.env.TOKEN})
  }

  consul.kv.set(params, cb);
};

var config_file = process.argv[process.argv.length-1];

console.log('Adding %s as consul config', config_file);

var config = fs.readFileSync(config_file, {'encoding':'utf8'});

try {
  JSON.parse(config);
} catch(e) {
  console.error('config_file is not valid JSON');
  process.exit(1);
}

exports.setConfig(config, function(err) {
  if (err) return console.error("Failed to write config: %s", err);
});
