var fs = require('fs');
var _ = require('underscore');

global.endpoint = "127.0.0.1";
global.port = 8500;
global.secure = false;
global.config = "default_config.json";

var parse_arguments = function() {
  for (var i = 2; i < process.argv.length; ++i) {
    if (process.argv[i] === '-s' || process.argv[i] === '--secure') global.secure = true;
    if (process.argv[i] === '-e' || process.argv[i] === '--endpoint') {
      if (i + 1 >= process.argv.length) {
        logger.error("No endpoint provided with --endpoint option");
        process.exit(3);
      }
      global.endpoint = process.argv[i + 1];
    }
    if (process.argv[i] === '-p' || process.argv[i] === '--port') {
      if (i + 1 >= process.argv.length) {
        logger.error("No port provided with --port option");
        process.exit(3);
      }
      global.port = process.argv[i + 1];
    }
    if (process.argv[i] === '-c' || process.argv[i] === '--config') {
      if (i + 1 >= process.argv.length) {
        logger.error("No config file provided with --config option");
        process.exit(3);
      }
      global.config = process.argv[i + 1];
    }
  }
};

var get_config_content = function() {
  var config_file = global.config;

  console.log('Adding %s as consul config', config_file);

  var config_content = fs.readFileSync(config_file, {'encoding': 'utf8'});

  try {
    JSON.parse(config_content);
  } catch (e) {
    console.error('config_file is not valid JSON');
    process.exit(1);
  }
  return config_content;
};

var push_config_to_consul = function(config_content) {
  var consul = require('consul')({'host': global.endpoint, 'port': global.port, 'secure': global.secure});

  var params = {'key': 'git2consul/config', 'value': config_content};

  console.log('Adding config %s : %s', params.key, params.value);

  if (process.env.TOKEN) {
    params = _.extend(params, {'token': process.env.TOKEN})
  }

  consul.kv.set(params, function(err) {
    if (err) return console.error("Failed to write config: %s", err);
  });
};

parse_arguments();
var config_content = get_config_content();
push_config_to_consul(config_content);

