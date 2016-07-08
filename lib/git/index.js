var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var util = require('util');

var config_reader = require('../config_reader.js');

var logger = require('../logging.js');

var Repo = require('./repo.js');

// By default, git2consul expects to run as a daemon.  If this flag is disabled, git2consul will not
// start any hooks and will shut down after initializing each branch in each repo.
Object.defineProperty(exports, 'daemon', {value: true, writable: true});

// Track all active Repo objects so we can traverse them as needed for a graceful shutdown.
Object.defineProperty(exports, 'repos', { value: {} });

// End the process once we are sure that no branches are busy updating.
exports.gracefulShutdown = function(cb) {
  for (var repo_name in exports.repos) {
    var repo = exports.repos[repo_name];
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

  // In some cases (such as unit tests), it might be good to know that halt was called.
  exports.halt_seen = true;

  /* istanbul ignore else */
  // If this method has a callback, fire it rather than killing the process.
  if (cb) {
    cb();
  } else if ((process.argv[1].indexOf('_mocha')) != -1) {
    logger.warn("Process is running in unit test.  Ignore shutdown.");
  } else {
    process.exit(0);
  }
};

/**
 * Halt all git_managers if git2consul config changes.
 */
var enableHaltOnChange = function() {
  config_reader.wait(function(err) {
    /* istanbul ignore if */
    if (err) {
      return logger.error("config poll failure due to %s.  Ignoring...", err);
    }

    exports.gracefulShutdown();
  });
};

/**
 * Provided a configuration object, walk all repo configs and initialize the child repos.
 */
exports.createRepos = function(config, cb) {
  var this_obj = this;

  var error_handler = function(err) {
    // Report the error to cb but also gracefully shutdown.
    exports.gracefulShutdown(cb(err));
  };

  // Validate that local_store exists.
  if (!config.local_store) {
    return error_handler("No local_store provided");
  }

  if (config.no_daemon === true) {
    // If we are running in no daemon mode, set git to disable any listeners that would keep
    // the process running after the initial sync.
    exports.daemon = false;
  } else if (config.halt_on_change === true) {
    // If we aren't running in no daemon mode and the configuration calls for halt on change, enable it.
    // We don't do this if config.no_daemon is enabled as the halt on change listener would keep the process
    // running.
    enableHaltOnChange();
  }

  // Build the root_directory, if necessary
  mkdirp(config.local_store, function(err) {

    if (err) {
      return error_handler("Failed to create local store " + config.local_store);
    }

    config.repos.forEach(function(repo_config) {

      try {
        // Each repo needs a copy of config.local_store
        repo_config.local_store = config.local_store;

        // Validate repo name is unique.
        if (exports.repos[repo_config.name]) {
          return cb("A repo with that name is already tracked.");
        }
        exports.repos[repo_config.name] = new Repo(repo_config);

        exports.repos[repo_config.name].init(function(err) {
          if (err) {
            return error_handler("Failed to load repo " + repo_config.name + " due to " + err);
          }

          logger.info("Loaded repo %s", repo_config.name);
          cb();
        });
      } catch(e) {
        /* istanbul ignore next */
        error_handler(e);
      }
    });
  });
};

