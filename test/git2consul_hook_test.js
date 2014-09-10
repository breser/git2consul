var should = require('should');
var _ = require('underscore');
var request = require('request');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');

[{
  'type': 'github',
  'url': '/githubpoke',
  'body': { ref: "refs/heads/master", head_commit: {id: 12345} },
  'fqurl': 'http://localhost:5151/githubpoke'
},{
  'type': 'stash',
  'url': '/stashpoke',
  'body': { refChanges: [{refId: "refs/heads/master", toHash: "0"}]},
  'fqurl': 'http://localhost:5050/stashpoke'
}].forEach(function(hook_config) {

  describe(hook_config.type + ' webhook', function() {

    var my_hooked_gm;

    before(function(done) {
      var config = git_utils.createConfig().repos[0];
      config.hooks = [hook_config];

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

        request({ url: hook_config.fqurl, method: 'POST', json: hook_config.body }, function(err) {
          if (err) return done(err);

          var check_value = function() {
            consul_utils.getValue('/test_repo/master/sample_key', function(err, value) {
              if (err) return done(err);

              if (!value) return setTimeout(check_value, 500);
              // If we get here, we know the value was purged.
              value.should.equal(sample_value);
              done();
            });
          };

          setTimeout(check_value, 500);
        });
      });
    });
  });
})
