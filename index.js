var logging = require('./lib/utils/logging.js');
var config_reader = require('./lib/utils/config_reader.js');

var util = require('util');

config_reader.read(function(err, config) {

  if (err) return console.error(err);

  logging.init(config);

  if (process.env.TOKEN) {
    // If a token was configured, register it with the consul broker
    require('./lib/consul_broker.js').setToken(process.env.TOKEN);
  }

  var logger = require('./lib/utils/logging.js');

  var git_manager = require('./lib/git_manager.js');

  if (!config.repos || !config.repos.length > 0) {
    // Fail startup.
    logger.error("No repos found in configuration.  Halting.")
    process.exit(1);
  }

  logger.info('git2consul is running');

  process.on('uncaughtException', function(err) {
    logger.error("Uncaught exception " + err);
  });

  // Set up the git manager for each repo.
  git_manager.manageRepos(config.repos, function(err) {
    if (err) {
      logger.error('Failed to create git managers due to %s', err);
      setTimeout(function() {
        // If any git manager failed to start, consider this a fatal error.
        process.exit(2);
      }, 2000);
    }
  });

});

