var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var util = require('util');

var logger = require('../logging.js');

var Repo = require('./repo.js');

// Track all active GitManager objects so we can traverse them as needed for a graceful shutdown.
var repos = exports.repos = {};

// End the process once we are sure that no branches are busy updating.
exports.gracefulShutdown = function(cb) {
  for (var repo_name in repos) {
    var repo = repos[repo_name];
    for (var i=0; i<repo.branch_names.length; ++i) {
      var branch_name = repo.branch_names[i];
      var branch = repo.getBranch(branch_name);
      if (branch && branch.busy) {
        logger.warn("Waiting for branch %s in repo %s", branch.name, repo_name);
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

exports.createRepos = function(config, cb) {
  var this_obj = this;

  var error_handler = function(err) {
    // Report the error to cb but also gracefully shutdown unless we are in test mode.
    cb(err);
    if (mock) var my_cb = function() { logger.error(err) };
    exports.gracefulShutdown(my_cb);
  };

  // TODO: Validate that local_store exists.

  // Build the root_directory, if necessary
  mkdirp(config.local_store, function(err) {

    if (err) return error_handler("Failed to create local store " + config.local_store);

    config.repos.forEach(function(repo_config) {

      try {

        if (err) return cb('Failed to create root_directory for repo: ' + err);

        // Each repo needs a copy of config.local_store
        repo_config.local_store = config.local_store;

        // Validate repo name is unique.
        if (repos[repo_config.name]) return cb("A repo with that name is already tracked.");
        repos[repo_config.name] = new Repo(repo_config);

        repos[repo_config.name].init(function(err) {
          if (err) return error_handler("Failed to load repo " + repo_config.name + " due to " + err);

          logger.info("Loaded repo %s", repo_config.name);
          cb();
        });
      } catch(e) {
        error_handler(e);
      }
    });

    cb();
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
