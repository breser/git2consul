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
[[{
  'type': 'github',
  'err': 'Hook configuration failed due to Invalid webhook port undefined'
}],[{
  'type': 'stash',
  'port': 5252,
  'err': 'Hook configuration failed due to No config url provided'
}]].forEach(function(hook_config) {

  describe(hook_config.type + ' webhook', function() {

    var my_hooked_gm;

    it ('should reject invalid webhook config', function(done) {
      var config = git_utils.createConfig().repos[0];
      config.hooks = hook_config;

      git_manager.manageRepo(config, function(err, gm) {
        err[0].should.equal(hook_config[0].err);
        done();
      });
    });
  });
});

// TODO: Test webhooks sharing a port
[[{
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
}]].forEach(function(hook_config) {

  describe(hook_config.type + ' webhook', function() {

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

    it ('should handle inbound requests', function(done) {
      var sample_key = 'sample_key';
      var sample_value = 'stash test data';
      git_utils.addFileToGitRepo(sample_key, sample_value, "Webhook.", false, function(err) {
        if (err) return done(err);

        request({ url: hook_config[0].fqurl, method: 'POST', json: hook_config[0].body }, function(err) {
          if (err) return done(err);

          consul_utils.waitForValue('test_repo/master/sample_key', function(err) {
            if (err) return done(err);
            done();
          });
        });
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
      'interval': '.01',
      'immediate_polling': true
    }];

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
