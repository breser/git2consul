var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var logger = require('./utils/logging.js');

var consul_broker = require('./consul_broker.js');
var git_commands = require('./utils/git_commands.js');

exports.purgeBranchCache = function(repo_config, branch, cb) {
  var branch_parent = repo_config.local_store + path.sep + repo_config.name;
  var branch_directory = branch_parent + path.sep + branch;

  rimraf(branch_directory, cb);
};

exports.manageBranch = function(repo_config, branch, branch_creation_callback) {

  var branch_parent = repo_config.local_store + path.sep + repo_config.name;
  var branch_directory = branch_parent + path.sep + branch;

  logger.info("Creating branch manager %s %s", branch_parent, branch_directory);

  var update_in_progress = false;
  var pending_ref_change = undefined;
  var pending_callbacks = [];

  var busy = false;

  /*
   *Create the branch manager object within the createBranchManager function so that certain state,
   * such as the branch_directory, becomes an immutable private enclosed by an instance of this object.
   */
  function BranchManager() {}

  /**
   * Clone is only run at create time, so do not make it a public method.
   */
  var clone = function(bm, cb) {
    busy = true;
    git_commands.clone(repo_config.url, branch, branch_parent, function(err, output) {
      /* istanbul ignore next */
      if (err) {
        busy = false;
        return cb(err);
      }
      consul_broker.handleRefChange(bm, cb);
    });
  };

  /**
   * Fetch the branch up to a given commit.  After this operation, the local copy should be up to date
   * with the branch at that commit.
   */
  BranchManager.prototype.pull = function(cb) {
    var this_obj = this;
    busy = true;
    git_commands.pull(branch_directory, function(err, output) {
      /* istanbul ignore next */
      if (err) {
        busy = false;
        return cb(err);
      }
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

  BranchManager.prototype.isBusy = function() {
    return busy;
  };

  /**
   * We want to lock handleRefChange so that only one is happening per branch_manager at a time.  This
   * function allows us to manage that locking behavior and will re-run handleRefChange if one or more are
   * queued up during execution of handleRefChange.
   */
  var wrap_callback = function(bm, cb) {

    // Once we wrap this callback, we are signalling that an update is in progress.
    update_in_progress = true;
    busy = true;

    return function(err, output) {
      // Callback seen.  Update no longer in progress.
      update_in_progress = false;

      // Grab a local copy of pending callbacks and reset the array.
      var my_pending_callbacks = pending_callbacks;
      pending_callbacks = [];

      // If a request to handle a ref_change came in while we were processing a prior ref_change, run
      // handleRefChange again.
      if (pending_ref_change) {
        bm.handleRefChange(pending_ref_change, function(err) {
          my_pending_callbacks.forEach(function(pending_callback) {
            pending_callback(err);
          });
        });

        // Reset the pending_refchange because it's been copied onto the callstack of handleRefChange.
        pending_ref_change = undefined;
      }

      busy = false;

      // Pass values to the original callback
      cb(err, output);
    };
  };

  BranchManager.prototype.handleRefChange = function(target_ref, cb) {

    // If an update is pending
    if (update_in_progress) {
      pending_ref_change = target_ref;
      pending_callbacks.push(cb);
      return;
    }

    this.pull(wrap_callback(this, cb));
  };

  // Create the branch manager.
  var bm = new BranchManager();

  busy = true;

  // Check to see if the branch directory is already present.
  fs.stat(branch_directory, function(err, stat) {
    if (stat) {
      // This branch was already cloned.  Do a pull to make sure it's up to date.
      return bm.getCurrentRef(function(err, ref) {
        if (err) {
          busy = false;
          return branch_creation_callback(err);
        }

        bm.pull(function(err, msg) {
          busy = false;
          /* istanbul ignore next */
          if (err) return branch_creation_callback(err);
          logger.info("Initialized branch manager: %s", msg);
          branch_creation_callback(null, bm);
        });
      });
    }

    // Create the branch_parent_directory (if necessary) and clone the branch from there.
    mkdirp(branch_parent, function(err) {
      /* istanbul ignore next */
      if (err) {
        busy = false;
        return branch_creation_callback(err);
      }

      // Clone the branch
      clone(bm, function(err, msg) {
        busy = false;
        /* istanbul ignore next */
        if (err) return branch_creation_callback(err);
        logger.info("Initialized branch manager: %s", msg);
        branch_creation_callback(null, bm);
      });
    });
  });
};
