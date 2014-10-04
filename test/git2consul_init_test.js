var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/utils/git_commands.js');

describe('Cloning a repo for the first time', function() {

  it ('should handle a multiple file repo', function(done) {
    var sample_key = 'sample_key';
    var sample_value = 'test data';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Clone test.", false, function(err) {
      if (err) return done(err);

      var sample_key2 = 'sample_key2';
      var sample_value2 = 'test data2';
      var default_repo_config = git_utils.createConfig().repos[0];
      git_utils.addFileToGitRepo(sample_key2, sample_value2, "Second file for clone test.", function(err) {
        if (err) return done(err);

        // At this point, the git_manager should have populated consul with our sample_key
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

describe('Initializing git2consul', function() {

  it ('should handle creating a git_manager around a repo that already exists', function(done) {
    var default_repo_config = git_utils.createConfig().repos[0];

    var sample_key = 'sample_key';
    var sample_value = 'test data';
    // This addFileToGitRepo will automatically create a git_manager in git_utils, so once the callback
    // has fired we know that we are mirroring and managing the master branch locally.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create a git repo.", function(err) {
      if (err) return done(err);

      // Now we create another git_manager around the same repo with the same local address.  This tells
      // us that a git_manager can be created around an existing repo without issue.
      git_manager.manageRepo(default_repo_config, function(err, gm) {
        (err === null).should.equal(true);
        done();
      });
    });
  });

  it ('should handle creating a git_manager around a repo that is been emptied', function(done) {
    var default_repo_config = git_utils.createConfig().repos[0];

    // This addFileToGitRepo will automatically create a git_manager in git_utils, so once the callback
    // has fired we know that we are mirroring and managing the master branch locally.
    git_utils.deleteFileFromGitRepo('readme.md', "Clearing repo.", function(err) {
      if (err) return done(err);

      // Now we create another git_manager around the same repo with the same local address.  This tells
      // us that a git_manager can be created around an existing repo without issue.
      git_manager.manageRepo(default_repo_config, function(err, gm) {
        (err === null).should.equal(true);
        done();
      });
    });
  });

  it ('should handle populating consul when you create a git_manager around a repo that is already on disk', function(done) {
    var default_repo_config = git_utils.createConfig().repos[0];

    var sample_key = 'sample_key';
    var sample_value = 'test data';

    // Create a git_manager and validate that the expected contents are present.  This should only be run
    // once we know the consul cluster has been purged of the previously cached values.
    var test_git_manager = function(done) {
      // Now we create another git_manager around the same repo with the same local address.  This tells
      // us that a git_manager can be created around an existing repo without issue.
      git_manager.manageRepo(default_repo_config, function(err, gm) {
        (err === null).should.equal(true);

        // At this point, the git_manager should have populated consul with our sample_key
        consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, sample_value, function(err, value) {
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

  it ('should handle creating multiple git repos', function(done) {
    var sample_key = 'sample_key';
    var sample_value = 'test data';
    var default_repo_config = git_utils.createConfig();

    // Add a Github repo to our repo config because we want to initialize multiple repos at once.
    default_repo_config.repos.push({
      name: 'test_github_repo',
      local_store: git_utils.TEST_GITHUB_WORKING_DIR,
      url: git_utils.TEST_GITHUB_REPO,
      branches: [ 'master' ]
    });

    // We use 'false' for the auto-commit flag on this call because we don't want a git_manager to be
    // created in git_utils.  We want the manageRepos call to be the first time we create any repos
    // in this test.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Multi repo test.", false, function(err) {
      if (err) return done(err);

      git_manager.manageRepos(default_repo_config.repos, function(err, gms) {
        if (err) return done(err);

        (err == null).should.equal(true);
        gms.length.should.equal(2);
        done();
      });
    });
  });
});
