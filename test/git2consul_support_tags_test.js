var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var git = require('../lib/git');
var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('Support tags', function() {
  it ('should populate consul with the sample key/value pair under master and the tag', function(done) {
    var repo_config = git_utils.createRepoConfig();
    repo_config.support_tags = true;

    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      var sample_key = 'readme.md';
      var sample_value = 'stub data';
      git_utils.addFileToGitRepo(sample_key, sample_value, "Stub commit.", function(err) {
        if (err) return done(err);

        git_utils.addTagToGitRepo("v0.1", "v0.1", function(err) {
          if (err) return done(err);
          var config = {
            repos: [repo_config],
            local_store: git_utils.TEST_WORKING_DIR,
            no_daemon: true
          };
  
          // Now, create a repo. The repo should populate consul with the proper values.
          git.createRepos(config, function(err) {
            consul_utils.validateValue(repo_config.name + '/' + 'master' + '/' + sample_key, sample_value, function(err, value) {
              consul_utils.validateValue(repo_config.name + '/' + 'v0.1' + '/' + sample_key, sample_value, function(err, value) {
                if (err) return done(err);
                (undefined === err).should.equal(true);
                done();
              });
            });
          });
        });
      });
    });
  });
});