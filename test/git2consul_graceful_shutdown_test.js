var should = require('should');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var git_manager = require('../lib/git_manager.js');

var git_utils = require('./utils/git_utils.js');

describe('Graceful Shutdown', function() {
  
  before(function() {
    git_manager.mock();
  });

  it ('should successfully fire if nothing else is happening', function(done) {
    git_manager.gracefulShutdown(function() {
      done();
    });
  });

  it ('should successfully fire if other stuff is happening', function(done) {

    // This should be set only once the handle ref has completed.
    var shutdown_seen = false;

    var sample_key = 'sample_key';
    var sample_value = 'new test data';
    git_utils.addFileToGitRepo(sample_key, sample_value, "Update a file.", false, function(err) {
      if (err) return done(err);

      git_utils.GM.getBranchManager('master').handleRefChange(0, function(err) {
        if (err) return done(err);
         shutdown_seen.should.equal(false);
      });

      // This should not fire until after we've processed the handleRefChange above
      git_manager.gracefulShutdown(function() {
        shutdown_seen = true;
        done();
      });
    });
  });

  after(function() {
    git_manager.mock();
  });

});
