var should = require('should');
var _ = require('underscore');
var fs = require('fs');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var logging = require('../lib/logging.js');
logging.init({
  "logger" : {
    "name" : "git2consul",
    "streams" : [{
      "level": "trace",
      "type": "rotating-file",
      "path": "./test/logs/test.log"
    },{
      "level": "warn",
      "stream": "process.stdout"
    }]
  }
});

var git = require('../lib/git');

var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

exports.cleanup = function(cb) {

  // Delete all tracked repos.
  for (var key in git.repos) {
    delete git.repos[key];
  }

  delete git.halt_seen;

  // Delete every key from consul.
  consul_utils.purgeKeys('', function(err) {
  if (err) return cb(err);
    // Delete the test remote repo
    rimraf(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return cb(err);

      // Recreate the test remote repo
      mkdirp(git_utils.TEST_REMOTE_REPO, function(err) {
        if (err) return cb(err);

        // Delete our local working dir
        rimraf(git_utils.TEST_WORKING_DIR, function(err) {
          if (err) return cb(err);

          // Recreate the local working dir
          mkdirp(git_utils.TEST_WORKING_DIR, function(err) {
            if (err) return cb(err);
            cb();
          });
        });
      });
    });
  });
};

// These cleanup operations need to run before each test to make sure the state of the
// suite is consistent.  Placed here, they will be run before all suites and tests.
beforeEach(function(done) {

  exports.cleanup(function(err) {
    if (err) return done(err);
    done();
  });
});
