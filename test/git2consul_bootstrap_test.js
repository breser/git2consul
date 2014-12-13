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

  consul_utils.purgeKeys('', function(err) {
  if (err) return cb(err);
    rimraf(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return cb(err);
      mkdirp(git_utils.TEST_REMOTE_REPO, function(err) {
        if (err) return cb(err);
        rimraf(git_utils.TEST_WORKING_DIR, function(err) {
          if (err) return cb(err);
          mkdirp(git_utils.TEST_WORKING_DIR, function(err) {
            if (err) return cb(err);
            rimraf(git_utils.TEST_GITHUB_WORKING_DIR, function(err) {
              if (err) return cb(err);
              mkdirp(git_utils.TEST_GITHUB_WORKING_DIR, function(err) {
                if (err) return cb(err);
                cb();
              });
            });
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
