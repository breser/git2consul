var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var util = require('util');

var logger = require('../logging.js');

var hook_providers = {
  'bitbucket' : require('./hooks/webhook.js').bitbucket,
  'github' : require('./hooks/webhook.js').github,
  'stash' : require('./hooks/webhook.js').stash,
  'polling' : require('./hooks/polling.js')
};

// Track all active GitManager objects so we can traverse them as needed for a graceful shutdown.
var repo_cache = {};

// End the process once we are sure that no branches are busy updating.
exports.gracefulShutdown = function(cb) {
  for (var repo_name in repo_cache) {  

    var my_git_manager = repo_cache[repo_name];

    var branch_names = my_git_manager.getBranchNames();
    for (var i=0; i<branch_names.length; ++i) {
      var branch_name = branch_names[i];
      var my_branch_manager = my_git_manager.getBranchManager(branch_name);
      if (my_branch_manager && my_branch_manager.isBusy()) {
        logger.warn("Waiting for branch %s in repo %s", branch_name, my_git_manager.getRepoName());
        setTimeout(function() {
          exports.gracefulShutdown(cb);
        }, 1000);
        return;
      }
    }
  }

  /* istanbul ignore else */
  // If we were provided a callback, fire it once we know all branches have quiesced.  Otherwise,
  // shutdown the process.
  if (cb) {
    cb();
  } else {
    process.exit(0);
  }
};

/**
 * Halt all git_managers if git2consul config changes.
 */
exports.enableHaltOnChange = function() {
  if (!daemon) {
    return logger.error("Halt on change requested but no_daemon mode is enabled.  Refusing to enable halt on change.")
  }

  config_reader.wait(function(err) {
    if (err) return logger.error("Config poll failure due to %s.  Ignoring...", err);

    exports.gracefulShutdown();
  });
};

exports.createRepo = function(config, repo_config, cb) {

  // Validate repo name is unique.
  if (git_cache[repo_config.name]) return cb("A repo with that name is already tracked.");
  git_cache[repo_config.name] = this_obj;

  var unique_branches = _.uniq(repo_config.branches);
  if (unique_branches.length !== repo_config.branches.length) 
    return cb("Duplicate name found in branches for repo " + repo_config.name + ": " + repo_config.branches);

  // Build the root_directory, if necessary
  mkdirp(config.local_store, function(err) {

    if (err) return cb('Failed to create root_directory for git manager: ' + err);

    // Each branch needs a copy of config.local_store
    repo_config.local_store = config.local_store;

    repo_config.branches.forEach(function(branch) {
      branch_manager.manageBranch(repo_config, branch, function(err, bm) {
        if (err) {
          // The most common reason for this to fail is due to a failed clone or otherwise corrupted git cache.  Try
          // killing the branch dir before failing so that the next start will have a clean slate.
          return branch_manager.purgeBranchCache(repo_config, branch, function() {
            cb('Failed to create manager for branch ' + branch + ': ' + err);
          });
        }

        ++branch_count;

        // Store the branch manager for future lookups
        logger.info("Storing branch manager for %s", bm.getBranchName());
        branch_managers[bm.getBranchName()] = bm;

        if (branch_count === repo_config.branches.length) {
          // We have a branch manager for each branch.
          logger.debug('Branch managers initialized');

          if (daemon && repo_config.hooks) {
            // Init hooks
            var errs = [];

            repo_config.hooks.forEach(function(hook) {
              try {
                var hook_provider = hook_providers[hook.type];
                if (!hook_provider) {
                  return errs.push("Invalid hook type " + hook.type);
                }

                hook_provider.init(hook, this_obj, mock);
              } catch (e) {
                return errs.push("Hook configuration failed due to " + e);
              }
            });

            if (errs.length > 0) return cb(errs);
          }

          cb(null, this_obj);
        }
      });
    });
  });

};

////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  Unit-testing aids
//
////////////////////////////////////////////////////////////////////////////////////////////////////

var mock = false;

/*
 * Turn on mocking mode so that we can inject some bogus config for the purposes of testing.
 */
exports.mock = function() {
  mock = true;
};

var daemon = true;

/**
 * By default, git2consul expects to run as a daemon.  If this flag is disabled, git2consul will not
 * start any hooks and will shut down after initializing each branch in each repo.
 */
exports.setDaemon = function(daemon_mode) {
  daemon = daemon_mode;
};

/**
 * Clear the git_manager hash.  This is useful for unit tests that need to recreate git_managers.
 */
exports.clearGitManagers = function() {
  git_cache = {};
};
