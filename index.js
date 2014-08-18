var util = require('util');

var config_reader = require('./utils/config_reader.js');
var git_manager_source = require('./lib/git_manager.js');

config_reader.read(function(err, config) {
  
  if (err) return console.error(err);
  
  console.log(util.inspect(config));
  
  if (!config.repos || !config.repos.length > 0) {
    // Fail startup.
    console.err("No repos found in configuration.  Halting.")
    process.exit(1);
  }
  
  // TODO: Complete repo config validation
  
  // Set up the git manager for each repo.
  git_manager_source.createGitManagers(config.repos, function(err) {
    if (err) {
      console.error('Failed to create git managers due to %s', err);
      setTimeout(function() {
        // If any git manager failed to start, consider this a fatal error.
        process.exit(2);
      }, 2000);
    }
  });
  
});
