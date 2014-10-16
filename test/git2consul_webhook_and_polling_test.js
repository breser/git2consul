var should = require('should');
var _ = require('underscore');
var request = require('request');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');

/**
 * Test webhooks and polling.  NOTE: This test needs to run last because the polling test case will
 * cause all sorts of race conditions for subsequent tests, and we didn't bother mocking up a way to
 * reach in and disable a polling hook once it starts running.
 */

// Test failing webhook configs
[[
  undefined
],[{
  'type': 'github',
  'err': 'Hook configuration failed due to Invalid webhook port undefined'
}],[{
  'type': 'stash',
  'port': 5252,
  'err': 'Hook configuration failed due to No config url provided'
}],[{
  'type': 'stash',
  'port': 5252,
  'url': '/happy',
  'err': 'Hook configuration failed due to A webhook is already listening on 5252, /poke'
},{
  'type': 'github',
  'port': 5252,
  'url': '/poke'
},{
  'type': 'github',
  'port': 5252,
  'url': '/poke'
}]].forEach(function(hook_config) {

  describe('webhook config validation', function() {

    var my_hooked_gm;

    it ('should reject invalid webhook config', function(done) {
      var config = git_utils.createConfig().repos[0];
      config.hooks = hook_config;

      git_manager.manageRepo(config, function(err, gm) {
        if (hook_config[0]) {
          err[0].should.equal(hook_config[0].err);
        } else {
          err[0].should.startWith('Hook configuration failed due to');
        }
        done();
      });
    });
  });
});

[
  // Test webhooks sharing a port
  [{
    'type': 'github',
    'url': '/githubpoke',
    'port': 5252,
    'body': { ref: "refs/heads/master", head_commit: {id: 12345} },
    'fqurl': 'http://localhost:5252/githubpoke'
  },{
    'type': 'stash',
    'url': '/stashpoke',
    'port': 5252,
    'body': { refChanges: [{refId: "refs/heads/master", toHash: "0"}]},
    'fqurl': 'http://localhost:5252/stashpoke'
  }],
  // Test no-op changes to an incorrect branch
  [{
    'type': 'github',
    'url': '/githubpoke_bogus_branch',
    'port': 5252,
    'body': { ref: "refs/heads/bogus_branch", head_commit: {id: 12345} },
    'fqurl': 'http://localhost:5252/githubpoke_bogus_branch',
    'no_change_expected': true
  },{
    'type': 'stash',
    'url': '/stashpoke_bogus_branch',
    'port': 5252,
    'body': { refChanges: [{refId: "refs/heads/bogus_branch", toHash: "0"}]},
    'fqurl': 'http://localhost:5252/stashpoke_bogus_branch',
    'no_change_expected': true
  }],
  // Test no-op changes with non-HEAD refs
  [{
    'type': 'github',
    'url': '/githubpoke_bogus_ref',
    'port': 5252,
    'body': { ref: "refs/remotes/origin/master", head_commit: {id: 12345} },
    'fqurl': 'http://localhost:5252/githubpoke_bogus_branch',
    'no_change_expected': true
  },{
    'type': 'stash',
    'url': '/stashpoke_bogus_ref',
    'port': 5252,
    'body': { refChanges: [{refId: "refs/remotes/zorigin_master", toHash: "0"}]},
    'fqurl': 'http://localhost:5252/stashpoke_bogus_ref',
    'no_change_expected': true
  }]
].forEach(function(hook_config) {

  describe('webhook', function() {

    var my_hooked_gm;

    before(function(done) {
      var config = git_utils.createConfig().repos[0];
      config.hooks = hook_config;

      git_manager.manageRepo(config, function(err, gm) {
        if (err) return done(err);

        my_hooked_gm = gm;
        done();
      });
    });

    // This creates a function suitable as the predicate of a mocha test.  The function will enclose
    // the config object and use it to send a request to the webhook and validate the response.
    var create_request_validator = function(config) {
      return function(done) {
        var sample_key = 'sample_key';
        var sample_value = 'stash test data';
        git_utils.addFileToGitRepo(sample_key, sample_value, "Webhook.", false, function(err) {
          if (err) return done(err);

          var req_conf = { url: config.fqurl, method: 'POST', json: config.body };
          if (config.type === 'stash') req_conf.headers = {'content-encoding':'UTF-8'};
          request(req_conf, function(err) {
            if (err) return done(err);

            // If this is a test that won't trigger an update, such as a req specifying an untracked branch,
            // short-circuit here and don't test for a KV update.
            if (config.no_change_expected) return done();

            consul_utils.waitForValue('test_repo/master/sample_key', function(err) {
              if (err) return done(err);

              done();
            });
          });
        });
      };
    };

    hook_config.forEach(function(config) {
      it (config.type + ' should handle inbound requests', create_request_validator(config));
    });
  });
});

// Test failing webhook configs
[[
  undefined
],[{
  'type': 'polling'
}],[{
  'type': 'polling',
  'interval': -1
}],[{
  'type': 'polling',
  'interval': 1.1
}]].forEach(function(hook_config) {

  describe('polling config validation', function() {

    var my_hooked_gm;

    it ('should reject invalid polling config', function(done) {
      var config = git_utils.createConfig().repos[0];
      config.hooks = hook_config;

      git_manager.manageRepo(config, function(err, gm) {
        if (hook_config[0]) {
          err[0].should.equal('Hook configuration failed due to Polling intervals must be positive integers');
        } else {
          err[0].should.startWith('Hook configuration failed due to');
        }
        done();
      });
    });
  });
});

describe('polling hook', function() {
  var my_hooked_gm;

  before(function(done) {
    var config = git_utils.createConfig().repos[0];
    config.hooks = [{
      'type': 'polling',
      'interval': '1'
    }];

    // Signal that we are in mocking mode to allow for < 1 minute polling
    git_manager.mock();

    git_manager.manageRepo(config, function(err, gm) {
      if (err) return done(err);

      my_hooked_gm = gm;
      done();
    });
  });

  it ('should handle inbound requests', function(done) {
    var sample_key = 'sample_key';
    var sample_value = 'stash test data';
    git_utils.addFileToGitRepo(sample_key, sample_value, "Webhook.", false, function(err) {
      if (err) return done(err);

      consul_utils.waitForValue('test_repo/master/sample_key', function(err) {
        if (err) return done(err);
        done();
      });
    });
  });
});
