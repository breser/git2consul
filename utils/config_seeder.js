var fs = require('fs');
var config_seeder = require('../lib/config_seeder.js')
var logger = require('../lib/logging.js');

/**
 * First, check if there is a command line override for the consul endpoint.
 * If so, use it to seed the config.
 */

global.endpoint = process.env.CONSUL_ENDPOINT || "127.0.0.1";
global.port = process.env.CONSUL_PORT || 8500;
global.secure = process.env.CONSUL_SECURE || false;
global.token = process.env.TOKEN || null;
global.config_key = "git2consul/config";

for (var i=2; i<process.argv.length; ++i) {
    if(process.argv[i] === '-s' || process.argv[i] === '--secure') global.secure = true;

    if(process.argv[i] === '-e' || process.argv[i] === '--endpoint') {
            if(i+1 >= process.argv.length) {
                    logger.error("No endpoint provided with --endpoint option");
                    process.exit(3);
            }
            global.endpoint = process.argv[i+1];
    }

    if(process.argv[i] === '-p' || process.argv[i] === '--port') {
      if(i+1 >= process.argv.length) {
        logger.error("No port provided with --port option");
        process.exit(3);
      }
      global.port = process.argv[i+1];
    }

    if(process.argv[i] === '-c' || process.argv[i] === '--config-key' || process.argv[i] === '--config_key') {
      if(i+1 >= process.argv.length) {
        logger.error("No consul Key name provided with --config-key option");
        process.exit(3);
      }
      global.config_key = process.argv[i+1];
    }
}

var config_file = process.argv[process.argv.length-1];

config_seeder.set(global.config_key, config_file, function(err){
  if (err) {
    logger.error(err);
    process.exit(1);
  }
});
