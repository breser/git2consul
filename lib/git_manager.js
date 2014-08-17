var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var util = require('util');

var branch_manager = require('./branch_manager.js');

var hook_providers = {
  'github' : require('./hooks/github.js'),
  'polling' : require('./hooks/polling.js'),
  'stash' : require('./hooks/stash.js')
};

/**
 * Manage a separate clone for each branch to reduce complexity of operations.
 */
exports.createGitManager = function(config, cb) {

  var branch_managers = {};
  
  function GitManager() {}
      
  var this_obj = new GitManager();
  var branch_count = 0;
  
  if (!config.branches || config.branches.length === 0) return cb('No branches specified');
  
  // Build the root_directory, if necessary
  mkdirp(config.local_store, function(err) {
    
    if (err) return cb('Failed to create root_directory for git manager: ' + err);
  
    config.branches.forEach(function(branch) {
      branch_manager.createBranchManager(config, branch, function(err, bm) {
        if (err) return cb('Failed to create manager for branch ' + branch + ': ' + err);
      
        ++branch_count;
      
        // Store the branch manager for future lookups
        console.log("Storing branch manager for %s", bm.getBranchName());
        branch_managers[bm.getBranchName()] = bm;
      
        if (branch_count === config.branches.length) {
          // We have a branch manager for each branch.
          console.log('Branch managers initialized');
        
          if (config.hooks) {
            // Init hooks
            config.hooks.forEach(function(hook) {
              var hook_provider = hook_providers[hook.type];
              if (!hook_provider) {
                return "Invalid hook type " + hook.type;
              }
    
              hook_provider.init(hook, this_obj);
            });
          }
        
          cb(null, this_obj);
        }
      });
    });
  });
  
  GitManager.prototype.getBranchNames = function() {
    return config.branches;
  };
  
  GitManager.prototype.getBranchManager = function(branch_name) {
    return branch_managers[branch_name];
  };
  
};
