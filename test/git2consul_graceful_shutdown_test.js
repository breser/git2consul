var should = require('should');

// We want this above any git2consul module to make sure logging gets configured
var bootstrap = require('./git2consul_bootstrap_test.js');

var git = require('../lib/git');

var git_utils = require('./utils/git_utils.js');

describe('Graceful Shutdown', function() {

  it ('should successfully fire if nothing else is happening', function(done) {
    git.gracefulShutdown(function() {
      done();
    });
  });

  it ('should successfully fire if other stuff is happening', function(done) {
    git_utils.initRepo(function(err, repo) {
      if (err) return done(err);

      // This should be set only once the handle ref has completed.
      var shutdown_seen = false;

      var sample_key = 'sample_key';
      var sample_value = 'new test data';
      git_utils.addFileToGitRepo(sample_key, sample_value, "Update a file.", function(err) {
        if (err) return done(err);

        var ref_change_handled = false;

        repo.branches['master'].handleRefChange(0, function(err) {
          if (err) return done(err);
          shutdown_seen.should.equal(false);
          ref_change_handled = true;
        });

        // This should not fire until after we've processed the handleRefChange above
        git.gracefulShutdown(function() {
          shutdown_seen = true;
          ref_change_handled.should.equal(true);
          done();
        });
      });

    });
  });

});
