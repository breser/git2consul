var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('Concurrency protections', function() {

  // Test that branches update correctly even in the presence of multiple pending updates, whether the
  // pending updates are serviced in arrival order or not.
  var concurrency_test = function(normal_ref_order) {

    var sample_key = 'sample_key';
    var sample_value = 'test data';

    return function(done) {

      git_utils.initRepo(function(err, repo) {

        // The default repo created by initRepo has a single branch, master.
        var branch = repo.branches['master'];

        // Handle the initial sync of this repo.  Init adds a file to the remote repo, and this line syncs
        // that to our local cache and to consul.
        branch.handleRefChange(0, function(err) {
          if (err) return done(err);

          // Now that we have a working repo, we start populating the remote end.  This test works by adding two
          // files in separate commits and then updating our local branch cache for both at the same time.  Here,
          // we add and commit the first file to the remote repo.
          git_utils.addFileToGitRepo(sample_key, sample_value, "Concurrency update.", function(err) {
            if (err) return done(err);

            // Grab the git ref of HEAD from the remote repo.  This represents the first change we need to sync.
            git_commands.getCurrentRef(git_utils.TEST_REMOTE_REPO, function(err, ref) {
              if (err) done(err);

              var first_ref = ref;

              var sample_key2 = 'sample_key2';
              var sample_value2 = 'test data2';

              // Add and commit the second file to the remote repo.
              git_utils.addFileToGitRepo(sample_key2, sample_value2, "Second file for concurrencty test.", function(err) {
                if (err) return done(err);

                // Grab the git ref of HEAD from the remote repo.  This represents the first change we need to sync.
                git_commands.getCurrentRef(git_utils.TEST_REMOTE_REPO, function(err, ref) {
                  if (err) done(err);

                  var second_ref = ref;

                  // Handle both ref changes.  The order in which we call handleRefChange is driven by normal_ref_order:
                  // in the 'true' case, we will call handleRefChange on the first commit first.
                  branch.handleRefChange((normal_ref_order ? first_ref : second_ref), function(cb) {
                    if (err) return done(err);
                  });

                  // Because calls to handleRefChange are serviced in arrival order, this invocation will always fire its
                  // callback after the above invocation.
                  branch.handleRefChange((normal_ref_order ? second_ref : first_ref), function(cb) {
                    if (err) return done(err);

                    // At this point, the local clone of the branch should have populated consul with both sample_keys
                    consul_utils.validateValue(repo.name + '/' + branch.name + '/' + sample_key, sample_value, function(err, value) {
                      if (err) return done(err);

                      consul_utils.validateValue(repo.name + '/' + branch.name + '/' + sample_key2, sample_value2, function(err, value) {
                        if (err) return done(err);
                        done();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    };
  };

  it ('should serialize access to a single branch', concurrency_test(true));
  it ('should serialize access to a single branch even if updates are out of order', concurrency_test(false));
});
