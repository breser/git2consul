var logging = require('./logging.js');

var fs = require('fs');
var os = require('os');

/**
 * First, check if there is a command line override for the consul endpoint
 * If so, use it to grab the config
 */

global.endpoint = "127.0.0.1";
global.port = 8500;
global.secure = false;
global.config_key = "git2consul/config"
for (var i=2; i<process.argv.length; ++i) {
  if(process.argv[i] === '-s' || process.argv[i] === '--secure') global.secure = true

  if(process.argv[i] === '-e' || process.argv[i] === '--endpoint') {
    if(i+1 >= process.argv.length) {
      logger.error("No endpoint provided with --endpoint option");
      process.exit(3);
    }
    global.endpoint = process.argv[i+1];
  }

  if(process.argv[i] === '-c' || process.argv[i] === '--config_key') {
    if(i+1 >= process.argv.length) {
      logger.error("No consul Key name provided with --config_key option");
      process.exit(4);
    }
    global.config_key = process.argv[i+1];
  }

  if(process.argv[i] === '-p' || process.argv[i] === '--port') {
    if(i+1 >= process.argv.length) {
      logger.error("No port provided with --port option");
      process.exit(5);
    }
    global.port = process.argv[i+1];
  }
}

var config_reader = require('./config_reader.js');

/**
 * Read config from a specially named Consul resource.  If the config was not seeded
 * (and this should be done using utils/config_seeder.js), git2consul will not boot.
 */
config_reader.read({'key': 'git2consul/config'}, function(err, config) {

  if (err) return console.error(err);

  // Logging configuration is specified in the config object, so initialize our logger
  // around that config.
  logging.init(config);

  if (process.env.TOKEN) {
    // If a token was configured, register it with the consul broker
    require('./consul').setToken(process.env.TOKEN);
  }

  var logger = require('./logging.js');

  var git = require('./git');

  if (!config.repos || !config.repos.length > 0) {
    // Fail startup.
    logger.error("No repos found in configuration.  Halting.")
    process.exit(1);
  }

  // Process command line switches, if any.  Command-line switches override the settings
  // loaded from Consul.
  for (var i=2; i<process.argv.length; ++i) {
    if (process.argv[i] === '-n' || process.argv[i] === '--no_daemon') config['no_daemon'] = true;
    if (process.argv[i] === '-h' || process.argv[i] === '--halt_on_change') config['halt_on_change'] = true;
    else if (process.argv[i] === '-d' || process.argv[i] === '--local_store') {
      if (i+1 >= process.argv[length]) {
        logger.error("No dir provided with --local_store option");
        process.exit(3);
      }
      config['local_store'] = process.argv[i+1];
      ++i;
    }
  }

  if (!config.local_store) {
    config.local_store = os.tmpdir();
  }

  logger.info('git2consul is running');

  process.on('uncaughtException', function(err) {
    logger.error("Uncaught exception " + err);
  });

  // Set up git for each repo
  git.createRepos(config, function(err) {
    if (err) {
      logger.error('Failed to create repos due to %s', err);
      setTimeout(function() {
        // If any git manager failed to start, consider this a fatal error.
        process.exit(2);
      }, 2000);
    }
  });

});

