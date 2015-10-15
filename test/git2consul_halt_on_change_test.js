var should = require('should');
var _ = require('underscore');
var request = require('request');

// We want this above any git2consul module to make sure logging gets configured
var bootstrap = require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var Repo = require('../lib/git/repo.js');
var git = require('../lib/git');
var git_commands = require('../lib/git/commands.js');
var git_utils = require('./utils/git_utils.js');

var logger = require('../lib/logging.js');

var consul = require('consul')();

var token = process.env.TOKEN;

/**
 * Test halt_on_change.  We register a config with halt on change functionality and validate
 * that halt is called on a consul config change.
 */
describe('halt_on_change', function() {

  it ('should halt git2consul when config changes', function(done) {

    consul.kv.set({'key': "git2consul/config", value: '{"fake":"config"}', token: token}, function(err) {
      if (err) done(err);

      var repo_config = git_utils.createRepoConfig();
      repo_config.hooks = [{
        'type': 'stash',
        'url': '/stashpoke_bogus_branch',
        'port': 5053
      }];
      repo_config.name = "halt_on_change_repo";

      git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
        if (err) return done(err);

        var sample_key = 'readme.md';
        var sample_value = 'stub data';
        git_utils.addFileToGitRepo(sample_key, sample_value, "Stub commit.", function(err) {
          if (err) return done(err);

          var config = {
            repos: [repo_config],
            local_store: git_utils.TEST_WORKING_DIR,
            halt_on_change: true
          };

          // Now, create a repo with hooks.  The hooks should be active.
          git.createRepos(config, function(err) {
            (undefined === err).should.equal(true);

            var repo = git.repos['halt_on_change_repo'];
            repo.hooks_active.should.equal(true);

            // Now update config and validate that a halt is seen.
            consul.kv.set({'key': "git2consul/config", value: '{"fake":"config2electricboogaloo"}', token: token}, function(err) {
              if (err) done(err);

              var check_halt = function() {
                if (git.halt_seen) return done();
                setTimeout(check_halt, 50);                
              };
              check_halt();
            });
          });
        });
      });
    });
  });
});
