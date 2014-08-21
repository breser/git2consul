var should = require('should');
var _ = require('underscore');
var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

var git_commands = require('../lib/utils/git_commands.js');

require('./git2consul_bootstrap_test.js');

var my_git_manager;

describe('in-place repos', function() {
  
  beforeEach(function(done) {
    var sample_key = 'sample_key';
    var sample_value = 'test data';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Pull test.", function(err) {
      if (err) return done(err);
        
      git_manager.createGitManager(default_repo_config, function(err, gm) {
        if (err) return done(err);
      
        my_git_manager = gm;
        done();
      });
    });
  });
  
  it ('should handle updates to a single file', function(done) {
    // At this point, my_git_manager should have populated consul with our sample_key.  Now update it.
    var sample_key = 'sample_key';
    var sample_value = 'new test data';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Update for pull test.", function(err) {
      if (err) return done(err);
      
      git_commands.getCurrentRef(git_utils.TEST_REPO, function(err, ref) {
        if (err) return done(err);
        
        my_git_manager.getBranchManager('master').handleRefChange(ref, function(err) {
          if (err) return done(err);
        
          // At this point, the git_manager should have populated consul with our sample_key
          consul_utils.getValue('/' + default_repo_config.name + '/master/' + sample_key, function(err, value) {
            if (err) return done(err);
            value.should.equal(sample_value);
            done();
          });
        });        
      });
    });
  });
  
  it ('should handle additions of new files', function(done) {
    // At this point, my_git_manager should have populated consul with our sample_key.  Now update it.
    var sample_key = 'sample_new_key';
    var sample_value = 'new value';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Update for pull test.", function(err) {
      if (err) return done(err);
      
      git_commands.getCurrentRef(git_utils.TEST_REPO, function(err, ref) {
        if (err) return done(err);
        
        my_git_manager.getBranchManager('master').handleRefChange(ref, function(err) {
          if (err) return done(err);
        
          // At this point, the git_manager should have populated consul with our sample_key
          consul_utils.getValue('/' + default_repo_config.name + '/master/' + sample_key, function(err, value) {
            if (err) return done(err);
            value.should.equal(sample_value);
            done();
          });
        });        
      });
    });
  });
});