var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
var bootstrap = require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var git = require('../lib/git');
var Repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('Cloning a repo for the first time', function() {

  it ('should handle a multiple file repo', function(done) {
    var repo_name = git_utils.repo.name;
    var sample_key = 'sample_key';
    var sample_value = 'test data';
    var default_repo_config = git_utils.createRepoConfig();
    git_utils.addFileToGitRepo(sample_key, sample_value, "Clone test.", false, function(err) {
      if (err) return done(err);

      var sample_key2 = 'sample_key2';
      var sample_value2 = 'test data2';
      var default_repo_config = git_utils.createRepoConfig();
      git_utils.addFileToGitRepo(sample_key2, sample_value2, "Second file for clone test.", function(err) {
        if (err) return done(err);

        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue(repo_name + '/master/' + sample_key, sample_value, function(err, value) {
          if (err) return done(err);
          consul_utils.validateValue(repo_name + '/master/' + sample_key2, sample_value2, function(err, value) {
            if (err) return done(err);
            done();
          });
        });
      });
    });
  });
});

describe('Initializing git2consul', function() {

  it ('should handle creating a repo tracking multiple branches', function(done) {
    var branches = ['dev', 'test', 'prod'];
    var repo_config = git_utils.createRepoConfig();
    repo_config.branches = branches;
    var branch_tests = [];
    var create_branch_and_add = function(branch_name, done) {
      return function() {
        git_commands.checkout_branch(branch_name, git_utils.TEST_REMOTE_REPO, function(err) {
          if (err) return done(err);

          git_utils.addFileToGitRepo("readme.md", "Stub file in " + branch_name + " branch", branch_name + " stub.", false, function(err) {
            if (err) return done(err);

            // If we've processed every branch, we are done and are ready to create a git manager around these
            // three branches.
            if (branch_tests.length === 0) {
              var repo = new Repo(repo_config);
              repo.init(function(err) {
                if (err) return done(err);
                done();
              });
            } else {
              // If there are more test functions to run, do so.
              branch_tests.pop()();
            }
          });
        });
      };
    };

    // Create a test function for each branch
    branches.forEach(function(branch_name) {
      branch_tests.push(create_branch_and_add(branch_name, done));
    });

    // Most tests assume that we want a repo already initted, so requiring bootstrap.js provides this.  However,
    // for this test, we want to start with a clean slate.
    bootstrap.cleanup(function(err) {
      if (err) done(err);
      git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
        if (err) return done(err);
        // Run the first test
        branch_tests.pop()();
      });
    });
  });

  it ('should handle creating a git_manager around a repo that already exists', function(done) {
    var repo_config = git_utils.createRepoConfig();

    var sample_key = 'sample_key';
    var sample_value = 'test data';
    // This addFileToGitRepo will automatically create a git_manager in git_utils, so once the callback
    // has fired we know that we are mirroring and managing the master branch locally.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create a git repo.", function(err) {
      if (err) return done(err);

      // Now we create another repo around the same repo with the same local address.  This tells
      // us that a git_manager can be created around an existing repo without issue.
      var repo = new Repo(repo_config);
      repo.init(function(err) {
        if (err) return done(err);
        done();
      });
    });
  });
/**
  it ('should handle creating a git_manager around a repo that has been emptied', function(done) {
    var repo_config = git_utils.createRepoConfig();

    // This addFileToGitRepo will automatically create a git_manager in git_utils, so once the callback
    // has fired we know that we are mirroring and managing the master branch locally.
    git_utils.deleteFileFromGitRepo('readme.md', "Clearing repo.", function(err) {
      if (err) return done(err);

      // Now we create another repo around the same repo with the same local address.  This tells
      // us that a git_manager can be created around an emptied repo without issue.
      var repo = new Repo(repo_config);
      repo.init(function(err) {
        if (err) return done(err);
        done();
      });
    });
  });

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

  var config = {
    local_store: git_utils.TEST_WORKING_DIR,
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

  var countdown = 2;

  it ('should handle creating multiple git repos', function(done) {
    git.createRepos(config, function(err) {
      (err === undefined).should.equal(true);
      git.repos.should.have.properties('repo1', 'repo2');

      --countdown;
      if (countdown === 0) done();
    });
  });
});
