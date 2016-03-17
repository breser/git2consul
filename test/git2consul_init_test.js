var should = require('should');
var _ = require('underscore');
var fs = require('fs');

var path = require('path');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var rimraf = require('rimraf');

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

  it ('should support disabling include_branch_name mode', function(done) {

    // Create a remote git repo.  Then, init a Repo object with include_branch_name disabled and validate
    // that files are in the appropriate place in the Consul KV store.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      git_utils.addFileToGitRepo("readme.md", "Test file branch-less KV", "Test commit.", function(err) {
        if (err) return done(err);

        var repo_config = git_utils.createRepoConfig();
        repo_config.include_branch_name = false;
        var repo = new Repo(repo_config);
        repo.init(function(err) {
          if (err) return done(err);
          consul_utils.validateValue('test_repo/readme.md', "Test file branch-less KV", function(err, value) {
            if (err) return done(err);
            done();
          });
        });
      });
    });
  });
});

describe ('Error handling', function() {
  it ('should gracefully handle a rebuild even when the local branch cache is corrupted', function(done) {
    // Create an empty git repo
    git_utils.initRepo(function(err, repo) {
      if (err) return done(err);

      // Now kill the git root of our working copy of the test repo, and kill it ahrd.
      rimraf(git_utils.TEST_WORKING_DIR + path.sep + 'test_repo' + path.sep + 'master' + path.sep + '.git', function(err) {
        if (err) return done(err);

        // Now try to create a new repo around that working dir.
        var repo = new Repo(git_utils.createRepoConfig());
        repo.init(function(err) {
          (undefined === err).should.equal(true);
          done();
        });
      });
    });
  });
});

describe ('Updates to existing local caches', function() {
  it ('should start correctly if the local cache already exists', function(done) {
    // Start off with a working repo instance
    git_utils.initRepo(function(err, repo) {
      if (err) return done(err);

      // Now purge the consul store of the uploaded value
      consul_utils.purgeKeys('test_repo', function(err) {
        if (err) return done(err);

        // Now try to recreate the repo, simulating a git2consul restart.  This should pull rather than clone the
        // git repo, but the result should be a correctly populated consul KV entry with the remote repo contents.
        repo.init(function(err) {
          (undefined === err).should.equal(true);
          consul_utils.validateValue('test_repo/master/readme.md', "Stub file to give us something to commit.", function(err, value) {
            if (err) return done(err);
            done();
          });
        });
      });
    });
  });
});

describe('git2consul config', function() {

  beforeEach(function(done) {

    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.
    git_utils.initRepo(function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];
      done();
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

describe('Configuration seeding for git2consul', function() {
  beforeEach(function(done) {

    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.
    git_utils.initRepo(function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];
      done();
    });
  });

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

  it ('should handle successfully creating config KV with config_seeder.set()', function(done) {
    fs.writeFileSync('/tmp/test_config.json', JSON.stringify(config));

    var config_seeder = require('../lib/config_seeder.js');
    config_seeder.set('git2consul/config', '/tmp/test_config.json', function(err) {
      (err == undefined).should.equal(true);
      done();
    });
  });

  it ('should handle successfully creating config KV in alternate location', function(done) {
    consul_utils.setValue('git2consul/alternate_config', JSON.stringify(config), function(err) {
      (err == undefined).should.equal(true);

      var config_reader = require('../lib/config_reader.js');
      config_reader.read({key: 'git2consul/alternate_config'}, function(err, config) {
        (err == undefined).should.equal(true);
        done();
      });
    });
  });
});
