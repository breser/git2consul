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
  config.repos.forEach(function(repo_config) {
    git_manager_source.createGitManager(repo_config, function(err, git_manager) {
      if (err) {
        // The failure to initialize a git manager is considered fatal.
        console.error('Failed to init repo %s due to %s', repo_config.name, err);
        //process.exit(2);
      }
    });
  });
  
});
