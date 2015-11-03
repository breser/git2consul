var should = require('should');
var _ = require('underscore');

var path = require('path');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var mkdirp = require('mkdirp');

var consul_utils = require('./utils/consul_utils.js');

var git = require('../lib/git');
var Repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('KV source_root', function() {

  it ('should support setting a custom source_root for repos', function(done) {

    // Create a remote git repo.  Then, init a Repo object with include_branch_name disabled and validate
    // that files are in the appropriate place in the Consul KV store.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      mkdirp(git_utils.TEST_REMOTE_REPO + "nested/enough/for/my/purposes", function(cb) {
        if (err) return done(err);

        git_utils.addFileToGitRepo("nested/enough/for/my/purposes/readme.md", "Test file beneath source_root", "Test commit.", function(err) {
          if (err) return done(err);

          var repo_config = git_utils.createRepoConfig();
          repo_config.source_root = "nested/enough";
          var repo = new Repo(repo_config);
          repo.init(function(err) {
            if (err) return done(err);
            consul_utils.validateValue('test_repo/master/for/my/purposes/readme.md', "Test file beneath source_root", function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

  it ('should support setting a custom source_root for repos', function(done) {

    // Create a remote git repo.  Then, init a Repo object with include_branch_name disabled and validate
    // that files are in the appropriate place in the Consul KV store.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      mkdirp(git_utils.TEST_REMOTE_REPO + "nested/enough/for/my/purposes", function(cb) {
        if (err) return done(err);

        git_utils.addFileToGitRepo("nested/enough/for/my/purposes/readme.md", "Test file beneath source_root", "Test commit.", function(err) {
          if (err) return done(err);

          var repo_config = git_utils.createRepoConfig();
          repo_config.source_root = "nested/enough/";
          var repo = new Repo(repo_config);
          repo.init(function(err) {
            if (err) return done(err);
            consul_utils.validateValue('test_repo/master/for/my/purposes/readme.md', "Test file beneath source_root", function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

});
