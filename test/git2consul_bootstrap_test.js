var should = require('should');
var _ = require('underscore');
var fs = require('fs');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var logging = require('../lib/utils/logging.js');
logging.init({
  "logger" : {
    "name" : "git2consul",
    "streams" : [{
      "level": "trace",
      "type": "rotating-file",
      "path": "./test/logs/test.log"
    }/**,{
      "level": "trace",
      "stream": "process.stdout"
    }/**/]
  }
});

var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

exports.cleanup = function(cb) {
  consul_utils.purgeKeys('test_repo', function(err) {
    if (err) return cb(err);
    consul_utils.purgeKeys('test_github_repo', function(err) {
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
  });
};

// These cleanup operations need to run before each test to make sure the state of the
// suite is consistent.  Placed here, they will be run before all suites and tests.
beforeEach(function(done) {
  exports.cleanup(function(err) {
    git_utils.initRepo(function(err) {
      if (err) return done(err);
      done();
    });
  });
});
