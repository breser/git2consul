var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/utils/git_commands.js');

describe('Cloning a repo for the first time', function() {
  
  it ('should handle a multiple file repo', function(done) {
    var sample_key = 'sample_key';
    var sample_value = 'test data';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Clone test.", function(err) {
      if (err) return done(err);

      var sample_key2 = 'sample_key2';
      var sample_value2 = 'test data2';
      var default_repo_config = git_utils.createConfig().repos[0];
      git_utils.addFileToGitRepo(sample_key2, sample_value2, "Second file for clone test.", function(err) {
        if (err) return done(err);
          
        git_manager.createGitManager(default_repo_config, function(err) {
          if (err) return done(err);
            
          // At this point, the git_manager should have populated consul with our sample_key
          consul_utils.getValue('/' + default_repo_config.name + '/master/' + sample_key, function(err, value) {
            if (err) return done(err);
            value.should.equal(sample_value);
            consul_utils.getValue('/' + default_repo_config.name + '/master/' + sample_key2, function(err, value) {
              if (err) return done(err);
              value.should.equal(sample_value2);
              done();
            });
          });
        });
      });
    });
  });
});

describe('Initializing git2consul', function() {

  it ('should handle creating a git_manager around a repo that already exists', function(done) {
    var default_repo_config = git_utils.createConfig().repos[0];

    var sample_key = 'sample_key';
    var sample_value = 'test data';
    git_utils.addFileToGitRepo(sample_key, sample_value, "Pull test.", function(err) {
      if (err) return done(err);
    
      git_manager.createGitManager(default_repo_config, function(err, gm) {
        (err === null).should.equal(true);
        done();
      });
    });
  });

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
