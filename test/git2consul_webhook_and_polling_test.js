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

    it ('should reject invalid webhook config', function(done) {

      git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
        if (err) return done(err);

        // When we create a repo, we need it to have an initial commit.  The call to addFile provides that.
        git_utils.addFileToGitRepo("readme.md", "Stub file to give us something to commit.", "Init webhook config repo.", function(err) {
          if (err) return done(err);

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
  });
});

// Add a file for the config, commit it, and validate that it has populated properly.
function create_tag_and_check_consul(version, repo_name, sample_key, done) {
  git_commands.tag(version, "first release", git_utils.TEST_REMOTE_REPO, function (err) {
      if (err) return done(err);

      consul_utils.waitForValue(repo_name + '/master/' + sample_key, function (err) {
        if (err) return done(err);

        consul_utils.waitForValue(repo_name + '/' + version + '/' + sample_key, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });
}
function extractReqInfo(config) {
  var req_conf = {url: config.fqurl, method: 'POST'};
  if (config.type === 'bitbucket') {
      req_conf.form = { payload: decodeURIComponent(config.body).replace(/\+/g, ' ') };
    } else req_conf.json = config.body

  if (config.type === 'stash') req_conf.headers = {'content-encoding': 'UTF-8'};
  return req_conf;
}

// Give us a mechanism to report on which set of hook params we're testing.
var test_counter = 0;
var test_descriptions = [
  "valid updates",
  "changes to untracked branches",
  "changes to non-HEAD refs"    
];

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
    'body': { refChanges: [{refId: "refs/heads/master", toHash: "0"}, {refId: "refs/heads/master", toHash: "0"}] },
    'fqurl': 'http://localhost:5252/stashpoke'
  },{
    'type': 'bitbucket',
    'url': '/bitbucketpoke',
    'port': 5252,
    // Seriously, their default POST hook is this ugly
    'body': '%7B%22repository%22%3A+%7B%22website%22%3A+null%2C+%22fork%22%3A+false%2C+%22name%22%3A+%22configuration%22%2C+%22scm%22%3A+%22git%22%2C+%22owner%22%3A+%22ryanbreen%22%2C+%22absolute_url%22%3A+%22%2Fryanbreen%2Fconfiguration%2F%22%2C+%22slug%22%3A+%22configuration%22%2C+%22is_private%22%3A+true%7D%2C+%22truncated%22%3A+false%2C+%22commits%22%3A+%5B%7B%22node%22%3A+%226f086f3d3de7%22%2C+%22files%22%3A+%5B%7B%22type%22%3A+%22modified%22%2C+%22file%22%3A+%22jobs_service%2Fauspice%2Fdemo-consumer-key%22%7D%5D%2C+%22raw_author%22%3A+%22Ryan+Breen+%3Crbreen%40vistaprint.com%3E%22%2C+%22utctimestamp%22%3A+%222014-10-18+23%3A20%3A47%2B00%3A00%22%2C+%22author%22%3A+%22Ryan+Breen%22%2C+%22timestamp%22%3A+%222014-10-19+01%3A20%3A47%22%2C+%22raw_node%22%3A+%226f086f3d3de724b9007934408e023b628a59ea15%22%2C+%22parents%22%3A+%5B%2230c88d68d029%22%5D%2C+%22branch%22%3A+%22master%22%2C+%22message%22%3A+%22Adding+bitbucket+test.%5Cn%22%2C+%22revision%22%3A+null%2C+%22size%22%3A+-1%7D%5D%2C+%22canon_url%22%3A+%22https%3A%2F%2Fbitbucket.org%22%2C+%22user%22%3A+%22ryanbreen%22%7D',
    'fqurl': 'http://localhost:5252/bitbucketpoke'
  },{
    'type': 'gitlab',
    'url': '/gitlabpoke',
    'port': 5252,
    'body': { after: "da1560886d4f094c3e6c9ef40349f7d38b5d27d7", ref: "refs/heads/master"},
    'fqurl': 'http://localhost:5252/gitlabpoke',
    'no_change_expected': true
  }],
  // Test no-op changes to an incorrect branch
  [{
    'type': 'github',
    'url': '/githubpoke_bogus_branch',
    'port': 5253,
    'body': { ref: "refs/heads/bogus_branch", head_commit: {id: 12345} },
    'fqurl': 'http://localhost:5253/githubpoke_bogus_branch',
    'no_change_expected': true
  },{
    'type': 'stash',
    'url': '/stashpoke_bogus_branch',
    'port': 5253,
    'body': { refChanges: [{refId: "refs/heads/bogus_branch", toHash: "deadbeef"}, {refId: "refs/heads/boguser_branch", toHash: "deadbeef"}] },
    'fqurl': 'http://localhost:5253/stashpoke_bogus_branch',
    'no_change_expected': true
  },{
    'type': 'bitbucket',
    'url': '/bitbucket_bogus_branch',
    'port': 5253,
    'body': '%7B%22repository%22%3A+%7B%22website%22%3A+null%2C+%22fork%22%3A+false%2C+%22name%22%3A+%22configuration%22%2C+%22scm%22%3A+%22git%22%2C+%22owner%22%3A+%22ryanbreen%22%2C+%22absolute_url%22%3A+%22%2Fryanbreen%2Fconfiguration%2F%22%2C+%22slug%22%3A+%22configuration%22%2C+%22is_private%22%3A+true%7D%2C+%22truncated%22%3A+false%2C+%22commits%22%3A+%5B%7B%22node%22%3A+%226f086f3d3de7%22%2C+%22files%22%3A+%5B%7B%22type%22%3A+%22modified%22%2C+%22file%22%3A+%22jobs_service%2Fauspice%2Fdemo-consumer-key%22%7D%5D%2C+%22raw_author%22%3A+%22Ryan+Breen+%3Crbreen%40vistaprint.com%3E%22%2C+%22utctimestamp%22%3A+%222014-10-18+23%3A20%3A47%2B00%3A00%22%2C+%22author%22%3A+%22Ryan+Breen%22%2C+%22timestamp%22%3A+%222014-10-19+01%3A20%3A47%22%2C+%22raw_node%22%3A+%226f086f3d3de724b9007934408e023b628a59ea15%22%2C+%22parents%22%3A+%5B%2230c88d68d029%22%5D%2C+%22branch%22%3A+%22dev%22%2C+%22message%22%3A+%22Adding+bitbucket+test.%5Cn%22%2C+%22revision%22%3A+null%2C+%22size%22%3A+-1%7D%5D%2C+%22canon_url%22%3A+%22https%3A%2F%2Fbitbucket.org%22%2C+%22user%22%3A+%22ryanbreen%22%7D',
    'fqurl': 'http://localhost:5253/bitbucket_bogus_branch',
    'no_change_expected': true
  },{
    'type': 'gitlab',
    'url': '/gitlab_bogus_branch',
    'port': 5253,
    'body': { after: "da1560886d4f094c3e6c9ef40349f7d38b5d27d7", ref: "refs/heads/bogus_branch"},
    'fqurl': 'http://localhost:5253/gitlab_bogus_branch',
    'no_change_expected': true
  }],
  // Test no-op changes with non-HEAD refs
  [{
    'type': 'github',
    'url': '/githubpoke_bogus_ref',
    'port': 5254,
    'body': { ref: "refs/remotes/origin/master", head_commit: {id: 12345} },
    'fqurl': 'http://localhost:5254/githubpoke_bogus_ref',
    'no_change_expected': true
  },{
    'type': 'stash',
    'url': '/stashpoke_bogus_ref',
    'port': 5254,
    'body': { refChanges: [{refId: "refs/remotes/origin/master", toHash: "0"}] },
    'fqurl': 'http://localhost:5254/stashpoke_bogus_ref',
    'no_change_expected': true
  },{
    'type': 'bitbucket',
    'url': '/bitbucket_bogus_ref',
    'port': 5254,
    'body': '',
    'fqurl': 'http://localhost:5254/bitbucket_bogus_ref',
    'no_change_expected': true
  },{
    'type': 'gitlab',
    'url': '/gitlab_bogus_ref',
    'port': 5254,
    'body': { after: "da1560886d4f094c3e6c9ef40349f7d38b5d27d7", ref: "refs/remotes/origin/master"},
    'fqurl': 'http://localhost:5254/gitlab_bogus_ref',
    'no_change_expected': true
  }]  
].forEach(function(hook_config) {

  describe('webhook', function() {

    // Add a file for the config, commit it, and validate that it has populated properly.
    var test_hook_req = function(config, cb) {
      var sample_key = 'webhook_key_' + config.type;
      var sample_value = config.type + ' test data';

      git_utils.addFileToGitRepo(sample_key, sample_value, "Webhook.", function(err) {
        if (err) return cb(err);

        var req_conf = extractReqInfo(config);

        request(req_conf, function(err) {

          setTimeout(function() {

            if (err) return cb(err);

            // If this is a test that won't trigger an update, such as a req specifying an untracked branch,
            // short-circuit here and don't test for a KV update.
            if (config.no_change_expected) return cb();

            consul_utils.waitForValue('test_repo/master/' + sample_key, function(err) {
              if (err) return cb(err);

              cb();
            });
          }, 500);
        });
      });
    };

    it ('should handle inbound requests with ' + test_descriptions[test_counter], function(done) {
      var repo_config = git_utils.createRepoConfig();
      repo_config.hooks = hook_config;

      git_utils.initRepo(repo_config, function(err, repo) {
        if (err) return done(err);

        // Test each hook config, 1 at a time.  Since they are updating the same repo, having all webhooks
        // fire in parallel would lead to undefined results.
        var test_config = function() {
          config = hook_config.pop();
          test_hook_req(config, function(err) {
            if (err) return done(err);

            if (hook_config.length > 0) return test_config();
            done();
          });
        };

        test_config();
      });
    });

    ++test_counter;
  });
});


describe('webhook with support_tags', function() {


  var test_hook_req_with_tag = function (config, cb) {
    var sample_key = 'webhook_key_' + config.type;
    var sample_value = config.type + ' test data';

    git_utils.addFileToGitRepo(sample_key, sample_value, "Webhook.", function (err) {
      if (err) return cb(err);

      var req_conf = extractReqInfo(config);

      request(req_conf, function (err) {
        setTimeout(function () {
          var version = "v1.5_7";
          config.body = {ref: "refs/tag/" + version, head_commit: {id: 12345}};
          var req_conf_for_tag = extractReqInfo(config);
          create_tag_and_check_consul(version, 'test_repo', sample_key, cb);
          request(req_conf_for_tag, function (err) {
            if (err) return cb(err);
          });
        }, 500);
      });
    });
  };

  it ('should handle support_tags with hooks', function(done) {

    var repo_config = git_utils.createRepoConfig();
    repo_config.support_tags = true;
    repo_config.hooks = [{
      'type': 'github',
      'url': '/githubpoke_with_tags',
      'port': 2345,
      'body': { ref: "refs/heads/master", head_commit: {id: 12345} },
      'fqurl': 'http://localhost:2345/githubpoke_with_tags'
    }];
    git_utils.initRepo(repo_config, function(err, repo) {
      if (err) return done(err);

      test_hook_req_with_tag(repo_config.hooks[0], function(err) {
        if (err) return done(err);
        done();
      });
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

    it ('should reject invalid polling config', function(done) {
      var repo_config = git_utils.createRepoConfig();
      repo_config.hooks = hook_config;

      git_utils.initRepo(repo_config, function(err, repo) {
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

  // Create a repo with a polling hook and validate that the KV is updated on a change to the remote
  // repo contents.
  it ('should handle polling updates', function(done) {

    var repo_config = git_utils.createRepoConfig();
    repo_config.hooks = [{
      'type': 'polling',
      'interval': '1'
    }];
    repo_config.name = "polling_test";

    git_utils.initRepo(repo_config, function(err, repo) {
      if (err) return done(err);

      repo.hooks_active.should.equal(true);

      var sample_key = 'sample_key';
      var sample_value = 'stash test data';
      git_utils.addFileToGitRepo(sample_key, sample_value, "Polling hook.", function(err) {
        if (err) return done(err);

        consul_utils.waitForValue('polling_test/master/sample_key', function(err) {
          if (err) return done(err);
          done();
        });
      });
    });
  });

  it('should handle polling updates for tags', function (done) {

    var repo_config = git_utils.createRepoConfig();
    repo_config.support_tags = true;
    repo_config.hooks = [{
      'type': 'polling',
      'interval': '1',
    }];
    repo_config.name = "polling_test_tags";

    git_utils.initRepo(repo_config, function (err, repo) {
      if (err) return done(err);

      repo.hooks_active.should.equal(true);

      var sample_key = 'sample_key';
      var sample_value = 'stash test data';
      git_utils.addFileToGitRepo(sample_key, sample_value, "Polling hook.", function (err) {
        if (err) return done(err);
        var version = "v1";
        create_tag_and_check_consul(version, repo_config.name, sample_key, done);
      });
    });
  });

});

describe('no daemon mode', function() {

  // No daemon mode works by disabling hooks.  Validate that no_daemon mode is enabled by attempting to start
  // a repo with hooks and checking that no hooks are actually running.
  it ('should disable hooks', function(done) {
    var repo_config = git_utils.createRepoConfig();
    repo_config.hooks = [{
      'type': 'polling',
      'interval': '1'
    },{
      'type': 'stash',
      'url': '/stashpoke_bogus_branch',
      'port': 5253
    }];
    repo_config.name = "you_shall_not_hook";

    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      var sample_key = 'readme.md';
      var sample_value = 'stub data';
      git_utils.addFileToGitRepo(sample_key, sample_value, "Stub commit.", function(err) {
        if (err) return done(err);

        var config = {
          repos: [repo_config],
          local_store: git_utils.TEST_WORKING_DIR,
          no_daemon: true
        };

        // Now, create a repo with hooks.  The hooks should not be active due to no_daemon mode.
        git.createRepos(config, function(err) {
          (undefined === err).should.equal(true);

          var repo = git.repos['you_shall_not_hook'];
          (undefined === repo.hooks_active).should.equal(true);
          
          done();
        });
      });
    });
  });
});

