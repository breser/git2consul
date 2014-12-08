var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('Key names', function() {

  var default_repo_config = git_utils.createRepoConfig();

  var test_add = function(key_name, key_value) {
    return function(done) {
      var repo_name = git_utils.repo.name;
      git_utils.addFileToGitRepo(key_name, key_value, key_name + " key name test.", function(err) {
        if (err) return done(err);

        // At this point, the git_manager should have populated consul with our sample_key
        consul_utils.validateValue(repo_name + '/master/' + key_name, key_value, function(err, value) {
          if (err) return done(err);
          done();
        });
      });
    }
  };

  ['sample key', 'sample:key', 'sample;key', 'sample\\key', 'sample@key', 'sample!key'].forEach(function(key_name) {
    var sample_value = 'new test data';
    it ('with troublesome characters, like ' + key_name + ' work properly', test_add(key_name, sample_value));
  });


});
