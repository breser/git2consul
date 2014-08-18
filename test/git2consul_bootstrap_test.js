var should = require('should');
var _ = require('underscore');
var fs = require('fs');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var git_commands = require('../lib/utils/git_commands.js');
var git_utils = require('./utils/git_utils.js');

// These cleanup operations need to run before each test to make sure the state of the
// suite is consistent.  Placed here, they will be run before all suites and tests.
beforeEach(function(done) {
  rimraf(git_utils.TEST_REMOTE_REPO, function(err) {
    if (err) return done(err);
    rimraf(git_utils.TEST_WORKING_DIR, function(err) {
      if (err) return done(err);
      mkdirp(git_utils.TEST_REMOTE_REPO, function(err) {
        if (err) return done(err);
        mkdirp(git_utils.TEST_WORKING_DIR, function(err) {
          if (err) return done(err);
          
          git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
            if (err) return done(err);
            done();
          });
        });
      })
    });
  });
});

