var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var logger = require('../logging.js');

var consul_broker = require('../consul');
var git_commands = require('./commands.js');

function Branch(repo_config, name) {
  // Immutable properties
  Object.defineProperty(this, 'url', {value: repo_config.url});
  Object.defineProperty(this, 'repo_name', {value: repo_config.name });
  Object.defineProperty(this, 'name', {value: name });
  Object.defineProperty(this, 'branch_parent', {value: repo_config.local_store + path.sep + repo_config.name});
  Object.defineProperty(this, 'branch_directory', {value: this.branch_parent + path.sep + name});
  Object.defineProperty(this, 'expand_keys', { value: repo_config['mode'] === 'expand_keys' });
  Object.defineProperty(this, 'include_branch_name', {
    // If include_branch_name is not set, assume true.  Otherwise, identity check the value against true.
    value: repo_config['include_branch_name'] == undefined || repo_config['include_branch_name'] === true
  });

  // Writable properties
  Object.defineProperty(this, 'busy', {value: false, writable: true});
  Object.defineProperty(this, 'update_in_progress', {value: false, writable: true});
  Object.defineProperty(this, 'pending_ref_change', {value: undefined, writable: true});
  Object.defineProperty(this, 'pending_callbacks', {value: [], writable: true});
}

Branch.prototype.clone = function(cb) {
  var this_obj = this;
  this_obj.busy = true;

  git_commands.clone(this_obj.url, this_obj.name, this_obj.branch_parent, function(err, output) {
    /* istanbul ignore next */
    if (err) {
      this_obj.busy = false;
      return cb(err);
    }
    consul_broker.handleRefChange(this_obj, cb);
  });
};

/**
 * Delete the local copy of this branch.  If the branch has been corrupted, this is the cleanest way
 * to reset things.
 */
Branch.prototype.purgeBranchCache = function(cb) {
  var this_obj = this;
  logger.warn("Purging branch cache %s for branch %s in repo %s", this.branch_directory, this.name, this.repo_name);
  rimraf(this.branch_directory, function(err) {
    /* istanbul ignore if */
    if (err) logger.error("Failed to purge branch cache %s", this_obj.branch_directory);
    cb();
  });
};

/**
 * Fetch the branch up to a given commit.  After this operation, the local copy should be up to date
 * with the branch at that commit.
 */
Branch.prototype.pull = function(cb) {
  var this_obj = this;
  this_obj.busy = true;
  git_commands.pull(this_obj.branch_directory, function(err, output) {
    /* istanbul ignore if */
    if (err) {
      this_obj.busy = false;
      return cb(err);
    }
    consul_broker.handleRefChange(this_obj, cb);
  });
};

Branch.prototype.listChangedFiles = function(from_ref, to_ref, cb) {
  git_commands.listChangedFiles(from_ref, to_ref, this.branch_directory, cb);
};

Branch.prototype.listAllFiles = function(cb) {
  git_commands.listAllFiles(this.branch_directory, cb);
};

Branch.prototype.getCurrentRef = function(cb) {
  git_commands.getCurrentRef(this.branch_directory, cb);
};

Branch.prototype.handleRefChange = function(target_ref, cb) {

  var this_obj = this;

  // If an update is pending
  if (this.update_in_progress) {
    this.pending_ref_change = target_ref;
    this.pending_callbacks.push(cb);
    return;
  }

  // Once we wrap this callback, we are signalling that an update is in progress.
  this_obj.update_in_progress = true;
  this_obj.busy = true;

  // We want to lock handleRefChange so that only one is happening per branch_manager at a time.  This
  // function allows us to manage that locking behavior and will re-run handleRefChange if one or more are
  // queued up during execution of handleRefChange.
  this.pull(function(err, output) {
    // Callback seen.  Update no longer in progress.
    this_obj.update_in_progress = false;

    // Grab a local copy of pending callbacks and reset the array.
    var my_pending_callbacks = this_obj.pending_callbacks;
    this_obj.pending_callbacks = [];

    // If a request to handle a ref_change came in while we were processing a prior ref_change, run
    // handleRefChange again.
    if (this_obj.pending_ref_change) {
      this_obj.handleRefChange(this_obj.pending_ref_change, function(err) {
        my_pending_callbacks.forEach(function(pending_callback) {
          pending_callback(err);
        });
      });

      // Reset the pending_refchange because it's been copied onto the callstack of handleRefChange.
      this_obj.pending_ref_change = undefined;
    }

    this_obj.busy = false;

    // Pass values to the original callback
    cb(err, output);
  });
};

Branch.prototype.init = function(cb) {

  var this_obj = this;

  logger.info("Initting branch %s %s", this_obj.branch_parent, this_obj.branch_directory);

  this_obj.busy = true;

  // Check to see if the branch directory is already present.
  fs.stat(this_obj.branch_directory, function(err, stat) {
    if (stat) {
      // This branch was already cloned.  Do a pull to make sure it's up to date.
      return this_obj.getCurrentRef(function(err, ref) {
        if (err) {
          this_obj.busy = false;
          // If we have a failure on getCurrentRef, we suspect that the local copy is hosed.  Purge it
          // so that it gets reloaded the next time git2consul starts.
          return this_obj.purgeBranchCache(function() {
            cb(err);
          });
        }

        this_obj.pull(function(err) {
          this_obj.busy = false;
          /* istanbul ignore if */
          if (err) return cb(err);
          logger.info("Initialized branch %s from %s", this_obj.name, this_obj.repo_name);
          cb();
        });
      });
    }

    // Create the branch_parent_directory (if necessary) and clone the branch from there.
    mkdirp(this_obj.branch_parent, function(err) {
      /* istanbul ignore next */
      if (err) {
        this_obj.busy = false;
        return cb(err);
      }

      // Clone the branch
      this_obj.clone(function(err) {
        this_obj.busy = false;
        /* istanbul ignore if */
        if (err) return cb(err);
        logger.info("Initialized branch %s from %s", this_obj.name, this_obj.repo_name);
        cb();
      });
    });
  });
};

module.exports = Branch;

