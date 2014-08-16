var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var util = require('util');

var branch_manager = require('./branch_manager.js');

/**
 * Manage a separate clone for each branch to reduce complexity of operations.
 */
exports.createGitManager = function(root_directory, git_url, branches, cb) {

  var branch_managers = {};
  
  function GitManager() {}
      
  var this_obj = new GitManager();
  var branch_count = 0;
  
  if (!branches || branches.length === 0) return cb('No branches specified');
  
  // Build the root_directory, if necessary
  mkdirp(root_directory, function(err) {
    if (err) return cb('Failed to create root_directory for git manager: ' + err);
    
    branches.forEach(function(branch) {
      branch_manager.createBranchManager(root_directory, git_url, branch, 'configuration', function(err, bm) {
        if (err) return cb('Failed to create manager for branch ' + branch + ': ' + err);
        
        ++branch_count;
        
        // Store the branch manager for future lookups
        console.log("Storing branch manager for %s", bm.getBranchName());
        branch_managers[bm.getBranchName()] = bm;
        
        if (branch_count === branches.length) {
          // We have a branch manager for each branch.
          console.log('Branch manager initialized');
          cb(null, this_obj);
        }
      });
    })
  });
  
  GitManager.prototype.handleRefChange = function(refChange, cb) {
    
    console.log('Handling reference change %s', util.inspect(refChange));

    // Only update if the head of a branch changed
    if (refChange.refId && (refChange.refId.indexOf('refs/heads/') === 0) && refChange.toHash) {
      // Strip leading 'refs/heads/' from branch name
      var branch_name = refChange.refId.substring(11);

      // Update consul git branch
      var bm = branch_managers[branch_name];
      if (!bm) return console.log('No branch_manager for branch %s, ignoring.', branch_name);
      bm.handleRefChange(refChange.toHash, function(err) {
        if (err) console.error(err);
      });
    }
  };
  
};
