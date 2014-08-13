var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

/**
 * Manage a separate clone for each branch to reduce complexity of operations.
 */
module.exports = function(root_directory, git_url, branches) {

  var branch_managers = {};
  
  function GitManager() {}
  
  GitManager.prototype.init = function(cb) {
    
    var this_obj = this;
    var branch_count = 0;
    
    if (!branches || branches.length === 0) return cb('No branches specified');
    
    // Build the root_directory, if necessary
    mkdirp(root_directory, function(err) {
      if (err) return cb('Failed to create root_directory for git manager: ' + err);
      
      branches.forEach(function(branch) {
        createBranchManager(branch, function(err) {
          if (err) return cb('Failed to create manager for branch ' + branch + ': ' + err);
          
          ++branch_count;
          
          if (branch_count === branches.length) {
            // We have a branch manager for each branch.
            console.log('Branch manager initialized');
            cb(null, this_obj);
          }
        });
      })
      
    });
  };
  
  GitManager.prototype.getBranchManager = function(branch) {
    return branch_managers[branch];
  };
  
  var createBranchManager = function(branch, cb) {
    var branch_directory = root_directory + path.sep + branch;
    
    function BranchManager() {}
  
    BranchManager.prototype.pull = function(cb) {
      console.log('Pulling from %s', branch_directory);
      var child = exec('git pull', {cwd: branch_directory}, function(err, stdout, stderr) {
        if (stdout) stdout.trim();
      
        if (err) return cb(err);
        cb(null, stdout);
      });
    };
  
    BranchManager.prototype.currentRef = function(cb) {
      console.log('Checking HEAD ref for %s', branch_directory);
      var child = exec('git log -n 1 --pretty=format:"%H"', {cwd: branch_directory}, function(err, stdout, stderr) {
        if (stdout) stdout.trim();

        if (err) return cb(err);
        cb(null, stdout);
      });
    };
  
    BranchManager.prototype.getPath = function() {
      return branch_directory;
    };
    
    fs.stat(branch_directory, function(err, stat) {
      if (stat) {
        // This branch was already cloned.  Do a pull to make sure it's up to date.
        branch_directory = branch_directory + path.sep + 'configuration';
        branch_managers[branch] = new BranchManager();
        branch_managers[branch].pull(cb);
        return;
      }
      
      console.log('Initializing branch manager at %s', branch_directory);
  
      mkdirp(branch_directory, function(err) {
        if (err) return cb(err);
        
        console.log("Running command in branch %s, dir %s", branch, branch_directory);
    
        var child = exec('git clone -b ' + branch + ' ' + git_url, {cwd: branch_directory}, function(err, stdout, stderr) {
          if (stdout) stdout.trim();
    
          if (err) return cb(err);
          
          branch_directory = branch_directory + path.sep + 'configuration'
          branch_managers[branch] = new BranchManager();
      
          cb(null, stdout);
        });
      });
    });
  };
  
  return new GitManager();
  
};
