var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/utils/git_commands.js');

describe('Concurrency protections', function() {

  var massive_concurrency_test = function(normal_ref_order) {

    var my_gm;

    var sample_key = 'sample_key';
    var sample_value = 'test data';

    var default_repo_config = git_utils.createRepoConfig();

    return function(done) {

      git_utils.addFileToGitRepo(sample_key, sample_value, "Concurrency update.", false, function(err) {
        if (err) return done(err);

        git_commands.getCurrentRef(git_utils.TEST_REMOTE_REPO, function(err, ref) {
          if (err) done(err);

          var first_ref = ref;

          var sample_key2 = 'sample_key2';
          var sample_value2 = 'test data2';

          git_utils.addFileToGitRepo(sample_key2, sample_value2, "Second file for concurrencty test.", false, function(err) {
            if (err) return done(err);

            git_commands.getCurrentRef(git_utils.TEST_REMOTE_REPO, function(err, ref) {
              if (err) done(err);

              var second_ref = ref;
              var bm = git_utils.GM.getBranchManager('master');

              bm.handleRefChange((normal_ref_order ? first_ref : second_ref), function(cb) {
                if (err) return done(err);
              });

              bm.handleRefChange((normal_ref_order ? second_ref : first_ref), function(cb) {
                if (err) return done(err);
                // At this point, the git_manager should have populated consul with both sample_key
                consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, sample_value, function(err, value) {
                  if (err) return done(err);

                  consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key2, sample_value2, function(err, value) {
                    if (err) return done(err);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    };
  };

  it ('should serialize access to a single branch', massive_concurrency_test(true));
  it ('should serialize access to a single branch even if updates are out of order', massive_concurrency_test(false));
});
