var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/utils/git_commands.js');

describe('git2consul Init', function() {

  it ('should handle creating multiple git repos', function(done) {
    var sample_key = 'sample_key';
    var sample_value = 'test data';
    var default_repo_config = git_utils.createConfig();
    default_repo_config.repos.push({
      name: 'test_github_repo',
      local_store: git_utils.TEST_GITHUB_WORKING_DIR,
      url: git_utils.TEST_GITHUB_REPO,
      branches: [ 'master' ]
    });
  
    git_utils.addFileToGitRepo(sample_key, sample_value, "Multi repo test.", function(err) {
      if (err) return done(err);
        
      git_manager.createGitManagers(default_repo_config.repos, function(err, gms) {
        if (err) return done(err);
        
        (err == null).should.equal(true);
        gms.length.should.equal(2);
        done();
      });
    });
  });
});
