var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
var bootstrap = require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var git = require('../lib/git');
var Repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('Initializing git2consul', function() {

  it ('should handle creating a repo tracking multiple branches', function(done) {

    // Create a remote git repo with 3 branches and a file per branch.  Then, init a Repo object and validate
    // that all 3 files are in the appropriate place in the Consul KV store.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      var repo_config = git_utils.createRepoConfig();
      repo_config.branches = ['dev', 'test', 'prod'];
      var branch_tests = [];

      var create_branch_and_add = function(branch_name, done) {
        return function() {
          git_commands.checkout_branch(branch_name, git_utils.TEST_REMOTE_REPO, function(err) {
            if (err) return done(err);

            git_utils.addFileToGitRepo("readme.md", "Test file in " + branch_name + " branch", branch_name + " commit", function(err) {
              if (err) return done(err);

              // If we've processed every branch, we are done and are ready to create a git manager around these
              // three branches.
              if (branch_tests.length === 0) {
                validate_result(done);
              } else {
                // If there are more test functions to run, do so.
                branch_tests.pop()();
              }
            });
          });
        };
      };

      // Create a test function for each branch
      repo_config.branches.forEach(function(branch_name) {
        branch_tests.push(create_branch_and_add(branch_name, done));
      });

      // Create the first branch test.
      branch_tests.pop()();

      // Once all branches have been populated, validate that the KV is in the right state.
      var validate_result = function(done) {
        var repo = new Repo(repo_config);
        repo.init(function(err) {
          if (err) return done(err);

          // Check consul for the correct file in each branch.
          consul_utils.validateValue('test_repo/dev/readme.md', "Test file in dev branch", function(err, value) {
            if (err) return done(err);
            consul_utils.validateValue('test_repo/test/readme.md', "Test file in test branch", function(err, value) {
              if (err) return done(err);
              consul_utils.validateValue('test_repo/prod/readme.md', "Test file in prod branch", function(err, value) {
                if (err) return done(err);
                done();
              });
            });
          });
        });
      };
    });
  });

/**

  it ('should handle populating consul when you create a git_manager around a repo that is already on disk', function(done) {
    var repo_name = git_utils.repo.name;
    var default_config = git_utils.createConfig();
    var default_repo_config = default_config.repos[0];
    default_repo_config.name = repo_name;
    git_manager.clearGitManagers();

    var sample_key = 'sample_key';
    var sample_value = 'test data';

    // Create a git_manager and validate that the expected contents are present.  This should only be run
    // once we know the consul cluster has been purged of the previously cached values.
    var test_git_manager = function(done) {
      // Now we create another git_manager around the same repo with the same local address.  This tells
      // us that a git_manager can be created around an existing repo without issue.
      git_manager.manageRepo(default_config, default_repo_config, function(err, gm) {
        (err === null).should.equal(true);

        // At this point, the git_manager should have populated consul with our sample_key
        consul_utils.validateValue(repo_name + '/master/' + sample_key, sample_value, function(err, value) {
          if (err) return done(err);
          done();
        });
      });
    };

    // This addFileToGitRepo will automatically create a git_manager in git_utils, so once the callback
    // has fired we know that we are mirroring and managing the master branch locally.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Stale repo test.", function(err) {
      if (err) return done(err);

      // Now we want to delete the KVs from Consul and create another git_manager with the same configuration.
      consul_utils.purgeKeys('test_repo', function(err) {
        if (err) return done(err);

        consul_utils.waitForDelete('test_repo?recurse', function(err) {
          if (err) return done(err);

          test_git_manager(done);
        });
      });
    });
  });
**/
});

describe('git2consul config', function() {

  beforeEach(function(done) {

    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.
    git_utils.initRepo(function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      // Handle the initial sync of this repo.  Init adds a file to the remote repo, and this line syncs
      // that to our local cache and to consul.
      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        done();
      });
    });
  });

  var config = {
    repos: [{
      name: 'repo1',
      url: 'file://' + git_utils.TEST_REMOTE_REPO,
      branches: [ 'master' ]
    },{
      name: 'repo2',
      url: git_utils.TEST_REMOTE_REPO,
      branches: [ 'master' ]
    }]
  };

  it ('should fail to create repos if no local_store is present on the top level config', function(done) {
    git.createRepos(config, function(err) {
      err.should.equal('No local_store provided');

      // Now fix config by adding local_store
      config.local_store = git_utils.TEST_WORKING_DIR;
      
      done();
    });
  });

  var countdown = 2;

  it ('should handle successfully creating multiple git repos with valid config', function(done) {
    git.createRepos(config, function(err) {
      (err === undefined).should.equal(true);
      git.repos.should.have.properties('repo1', 'repo2');

      --countdown;
      if (countdown === 0) done();
    });
  });
});
