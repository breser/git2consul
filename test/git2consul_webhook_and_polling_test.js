var should = require('should');
var _ = require('underscore');
var request = require('request');

// We want this above any git2consul module to make sure logging gets configured
var bootstrap = require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var Repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');

var logger = require('../lib/logging.js');

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
      var repo_config = git_utils.createRepoConfig();
      repo_config.hooks = hook_config;

      var repo = new Repo(repo_config);
      repo.init(function(err) {
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

var repo_counter = 0;

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
  },{
    'type': 'bitbucket',
    'url': '/bitbucketpoke',
    'port': 5252,
    // Seriously, their default POST hook is this ugly
    'body': '%7B%22repository%22%3A+%7B%22website%22%3A+null%2C+%22fork%22%3A+false%2C+%22name%22%3A+%22configuration%22%2C+%22scm%22%3A+%22git%22%2C+%22owner%22%3A+%22ryanbreen%22%2C+%22absolute_url%22%3A+%22%2Fryanbreen%2Fconfiguration%2F%22%2C+%22slug%22%3A+%22configuration%22%2C+%22is_private%22%3A+true%7D%2C+%22truncated%22%3A+false%2C+%22commits%22%3A+%5B%7B%22node%22%3A+%226f086f3d3de7%22%2C+%22files%22%3A+%5B%7B%22type%22%3A+%22modified%22%2C+%22file%22%3A+%22jobs_service%2Fauspice%2Fdemo-consumer-key%22%7D%5D%2C+%22raw_author%22%3A+%22Ryan+Breen+%3Crbreen%40vistaprint.com%3E%22%2C+%22utctimestamp%22%3A+%222014-10-18+23%3A20%3A47%2B00%3A00%22%2C+%22author%22%3A+%22Ryan+Breen%22%2C+%22timestamp%22%3A+%222014-10-19+01%3A20%3A47%22%2C+%22raw_node%22%3A+%226f086f3d3de724b9007934408e023b628a59ea15%22%2C+%22parents%22%3A+%5B%2230c88d68d029%22%5D%2C+%22branch%22%3A+%22master%22%2C+%22message%22%3A+%22Adding+bitbucket+test.%5Cn%22%2C+%22revision%22%3A+null%2C+%22size%22%3A+-1%7D%5D%2C+%22canon_url%22%3A+%22https%3A%2F%2Fbitbucket.org%22%2C+%22user%22%3A+%22ryanbreen%22%7D',
    'fqurl': 'http://localhost:5252/bitbucketpoke'
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
  },{
    'type': 'bitbucket',
    'url': '/bitbucket_bogus_branch',
    'port': 5252,
    'body': '%7B%22repository%22%3A+%7B%22website%22%3A+null%2C+%22fork%22%3A+false%2C+%22name%22%3A+%22configuration%22%2C+%22scm%22%3A+%22git%22%2C+%22owner%22%3A+%22ryanbreen%22%2C+%22absolute_url%22%3A+%22%2Fryanbreen%2Fconfiguration%2F%22%2C+%22slug%22%3A+%22configuration%22%2C+%22is_private%22%3A+true%7D%2C+%22truncated%22%3A+false%2C+%22commits%22%3A+%5B%7B%22node%22%3A+%226f086f3d3de7%22%2C+%22files%22%3A+%5B%7B%22type%22%3A+%22modified%22%2C+%22file%22%3A+%22jobs_service%2Fauspice%2Fdemo-consumer-key%22%7D%5D%2C+%22raw_author%22%3A+%22Ryan+Breen+%3Crbreen%40vistaprint.com%3E%22%2C+%22utctimestamp%22%3A+%222014-10-18+23%3A20%3A47%2B00%3A00%22%2C+%22author%22%3A+%22Ryan+Breen%22%2C+%22timestamp%22%3A+%222014-10-19+01%3A20%3A47%22%2C+%22raw_node%22%3A+%226f086f3d3de724b9007934408e023b628a59ea15%22%2C+%22parents%22%3A+%5B%2230c88d68d029%22%5D%2C+%22branch%22%3A+%22dev%22%2C+%22message%22%3A+%22Adding+bitbucket+test.%5Cn%22%2C+%22revision%22%3A+null%2C+%22size%22%3A+-1%7D%5D%2C+%22canon_url%22%3A+%22https%3A%2F%2Fbitbucket.org%22%2C+%22user%22%3A+%22ryanbreen%22%7D',
    'fqurl': 'http://localhost:5252/bitbucket_bogus_branch',
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
    'body': { refChanges: [{refId: "refs/remotes/origin/master", toHash: "0"}]},
    'fqurl': 'http://localhost:5252/stashpoke_bogus_ref',
    'no_change_expected': true
  },{
    'type': 'bitbucket',
    'url': '/bitbucket_bogus_ref',
    'port': 5252,
    'body': '',
    'fqurl': 'http://localhost:5252/bitbucket_bogus_ref',
    'no_change_expected': true
  }]
].forEach(function(hook_config) {

  describe('webhook', function() {

    before(function(done) {

      // Enable manual mode.  We don't want the standard git2consul bootstrap tests to create a git_manager
      // that is enabled without hooks as this just causes endless confusion.
      bootstrap.manual_mode(true);

      bootstrap.cleanup(function(err) {

        if (err) return done(err);

        var repo_config = git_utils.createRepoConfig();
        repo_config.hooks = hook_config;
        repo_config.name = "webhook_test" + repo_counter;
        ++repo_counter;

        git_utils.initRepo(repo_config, function(err, gm) {
          if (err) return done(err);
          done();
        });

      });
    });

    var sample_data_randomizer = 0;

    // This creates a function suitable as the predicate of a mocha test.  The function will enclose
    // the config object and use it to send a request to the webhook and validate the response.
    var create_request_validator = function(config) {
      return function(done) {
        var repo_name = git_utils.repo.name;
        var sample_key = 'sample_key';
        var sample_value = 'stash test data ' + sample_data_randomizer;
        ++sample_data_randomizer;
        git_utils.addFileToGitRepo(sample_key, sample_value, "Webhook.", false, function(err) {
          if (err) return done(err);

          var req_conf = { url: config.fqurl, method: 'POST' };
          if (config.type === 'bitbucket') {
            req_conf.form = { payload: decodeURIComponent(config.body).replace(/\+/g, ' ') };
          } else req_conf.json = config.body
          
          if (config.type === 'stash') req_conf.headers = {'content-encoding':'UTF-8'};
          request(req_conf, function(err) {

            if (err) return done(err);

            // If this is a test that won't trigger an update, such as a req specifying an untracked branch,
            // short-circuit here and don't test for a KV update.
            if (config.no_change_expected) return done();

            consul_utils.waitForValue(repo_name + '/master/sample_key', function(err) {
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
      var repo_config = git_utils.createRepoConfig();
      repo_config.hooks = hook_config;

      var repo = new Repo(repo_config);
      repo.init(function(err) {
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

  before(function(done) {

    // Enable manual mode.  We don't want the standard git2consul bootstrap tests to create a git_manager
    // that is enabled without hooks as this just causes endless confusion.
    bootstrap.manual_mode(true);
    process.env.MOCK = true;

    bootstrap.cleanup(function(err) {

      if (err) return done(err);

      var repo_config = git_utils.createRepoConfig();
      repo_config.hooks = [{
        'type': 'polling',
        'interval': '1'
      }];
      repo_config.name = "polling_test";

      git_utils.initRepo(repo_config, function(err, gm) {
        if (err) return done(err);
        done();
      });

    });
  });

  it ('should handle polling updates', function(done) {
    var repo_name = git_utils.repo.name;
    var sample_key = 'sample_key';
    var sample_value = 'stash test data';
    git_utils.addFileToGitRepo(sample_key, sample_value, "Webhook.", false, function(err) {
      if (err) return done(err);

      consul_utils.waitForValue(repo_name + '/master/sample_key', function(err) {
        if (err) return done(err);
        done();
      });
    });
  });
});

