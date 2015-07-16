var should = require('should');
var _ = require('underscore');

var path = require('path');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var rimraf = require('rimraf');

var consul_utils = require('./utils/consul_utils.js');

var git = require('../lib/git');
var Repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('KV mountpoint', function() {

  it ('should support setting a custom mountpoint for keys', function(done) {

    // Create a remote git repo.  Then, init a Repo object with include_branch_name disabled and validate
    // that files are in the appropriate place in the Consul KV store.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      git_utils.addFileToGitRepo("readme.md", "Test file mountpointed KV", "Test commit.", function(err) {
        if (err) return done(err);

        var repo_config = git_utils.createRepoConfig();
        repo_config.mountpoint = "nested/enough/for/my/purposes";
        var repo = new Repo(repo_config);
        repo.init(function(err) {
          if (err) return done(err);
          consul_utils.validateValue('nested/enough/for/my/purposes/test_repo/master/readme.md', "Test file mountpointed KV", function(err, value) {
            if (err) return done(err);
            done();
          });
        });
      });
    });
  });

  it ('custom mountpoints should work with include_branch_name disabled', function(done) {

    // Create a remote git repo.  Then, init a Repo object with include_branch_name disabled and validate
    // that files are in the appropriate place in the Consul KV store.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      git_utils.addFileToGitRepo("readme.md", "Test file mountpointed KV", "Test commit.", function(err) {
        if (err) return done(err);

        var repo_config = git_utils.createRepoConfig();
        repo_config.mountpoint = "nested/enough/for/my/purposes";
        repo_config.include_branch_name = false;
        var repo = new Repo(repo_config);
        repo.init(function(err) {
          if (err) return done(err);
          consul_utils.validateValue('nested/enough/for/my/purposes/test_repo/readme.md', "Test file mountpointed KV", function(err, value) {
            if (err) return done(err);
            done();
          });
        });
      });
    });
  });


});
