var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

var logger = require('./utils/logging.js');

var consul_broker = require('./consul_broker.js');
var git_commands = require('./utils/git_commands.js');

exports.createBranchManager = function(repo_config, branch, branch_creation_callback) {

  var branch_parent = repo_config.local_store + path.sep + branch;
  var branch_directory = branch_parent + path.sep + repo_config.name;

  var update_in_progress = false;
  var pending_ref_change = undefined;
  
  var most_recent_ref = undefined;
  
  /*
   *Create the branch manager object within the createBranchManager function so that certain state,
   * such as the branch_directory, becomes an immutable private enclosed by an instance of this object.
   */
  function BranchManager() {}

  /**
   * Clone is only run at create time, so do not make it a public method.
   */
  var clone = function(bm, cb) {
    git_commands.clone(repo_config.url, repo_config.name, branch, branch_parent, function(err, output) {
      if (err) return cb(err);
      consul_broker.handleRefChange(bm, cb);
    });
  };

  /**
   * Fetch the branch up to a given commit.  After this operation, the local copy should be up to date
   * with the branch at that commit.
   */
  BranchManager.prototype.pull = function(cb) {
    var this_obj = this;
    git_commands.pull(branch_directory, function(err, output) {
      if (err) return cb(err);
      consul_broker.handleRefChange(this_obj, cb);
    });
  };

  BranchManager.prototype.listChangedFiles = function(from_ref, to_ref, cb) {
    git_commands.listChangedFiles(from_ref, to_ref, branch_directory, cb);
  };

  BranchManager.prototype.listAllFiles = function(cb) {
    git_commands.listAllFiles(branch_directory, cb);
  };

  BranchManager.prototype.getCurrentRef = function(cb) {
    git_commands.getCurrentRef(branch_directory, cb);
  };
  
  BranchManager.prototype.getRepoName = function() {
    return repo_config.name;
  };
  
  BranchManager.prototype.getBranchName = function() {
    return branch;
  };
  
  BranchManager.prototype.getBranchDirectory = function() {
    return branch_directory;
  };
  
  BranchManager.prototype.getMostRecentRef = function() {
    return most_recent_ref;
  };
  
  BranchManager.prototype.setMostRecentRef = function(ref) {
    most_recent_ref = ref;
  };

  /**
   * We want to lock handleRefChange so that only one is happening per branch_manager at a time.  This
   * function allows us to manage that locking behavior and will re-run handleRefChange if one or more are
   * queued up during execution of handleRefChange. 
   */
  var wrap_callback = function(bm, cb) {
    
    // Once we wrap this callback, we are signalling that an update is in progress.
    update_in_progress = true;
    
    return function(err, output) {
      // Callback seen.  Update no longer in progress.
      update_in_progress = false;
      
      // If a request to handle a ref_change came in while we were processing a prior ref_change, run
      // handleRefChange again.
      if (pending_ref_change) {
        bm.handleRefChange(pending_ref_change, function(err) {
          if (err) logger.error(err);
        });
        
        // Reset the pending_refchange because it's been copied onto the callstack of handleRefChange.
        pending_ref_change = undefined;
      }
      
      // Pass values to the original callback
      cb(err, output);
    };
  };
  
  BranchManager.prototype.handleRefChange = function(target_ref, cb) {
    
    // If an update is pending 
    if (update_in_progress) {
      pending_ref_change = target_ref;
      return cb(null, 'Another refChange is in flight.  Queueing this one.');
    }

    if (this.getMostRecentRef() === target_ref) {
      logger.debug('Branch %s already at most recent version', this.getBranchName());
      return cb(null);
    }

    this.pull(wrap_callback(this, cb));
  };
  
  // Create the branch manager.
  var bm = new BranchManager();
  
  // Check to see if the branch_parent is already present.
  fs.stat(branch_parent, function(err, stat) {
    if (stat) {
      // This branch was already cloned.  Do a pull to make sure it's up to date.
      return bm.getCurrentRef(function(err, ref) {
        if (err) return branch_creation_callback(err);
        
        // Make sure we store the most recent ref before we run pull.  This is so that we can update
        // consul on the delta between that ref and the current ref, should the subsequent pull find updates.
        bm.setMostRecentRef(ref);
        
        bm.pull(function(err, msg) {
          if (err) return branch_creation_callback(err);
          logger.info("Initialized branch manager: %s", msg);
          branch_creation_callback(null, bm);
        });
      });
    }

    // Create the branch_parent_directory and clone the branch from there.
    mkdirp(branch_parent, function(err) {
      if (err) return branch_creation_callback(err);

      // Clone the branch
      clone(bm, function(err, msg) {
        if (err) return branch_creation_callback(err);
        logger.info("Initialized branch manager: %s", msg);
        branch_creation_callback(null, bm);
      });
    });
  });
};
