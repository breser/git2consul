var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/utils/git_commands.js');

describe('Concurrency protections', function() {
  
  var my_gm;
  
  var default_repo_config = git_utils.createConfig().repos[0];

  var sample_key = 'sample_key';
  var sample_value = 'test data';
  
  beforeEach(function(done) {
    git_utils.addFileToGitRepo(sample_key, sample_value, "Concurrency test.", function(err) {
      git_manager.createGitManager(default_repo_config, function(err, gm) {
        if (err) return done(err);
        
        my_gm = gm;
        done();
      });
    });
  });
  
  it ('should serialize access to a single branch', function(done) {
    
    sample_value = 'new value';
    
    git_utils.addFileToGitRepo(sample_key, sample_value, "Concurrency update.", function(err) {
      if (err) return done(err);
      
      git_commands.getCurrentRef(git_utils.TEST_REMOTE_REPO, function(err, ref) {
        if (err) done(err);
      
        var first_ref = ref;
      
        var sample_key2 = 'sample_key2';
        var sample_value2 = 'test data2';
      
        git_utils.addFileToGitRepo(sample_key2, sample_value2, "Second file for concurrencty test.", function(err) {
          if (err) return done(err);
    
          git_commands.getCurrentRef(git_utils.TEST_REMOTE_REPO, function(err, ref) {
            if (err) done(err);
      
            var second_ref = ref;
            var bm = my_gm.getBranchManager('master');
            bm.handleRefChange(first_ref, function(cb) {
              if (err) return done(err);
              console.log('!!!!!!!!!!!Handled ref change to first ref %s', first_ref);
            });
          
            bm.handleRefChange(second_ref, function(cb) {
              if (err) return done(err);
              console.log('!!!!!!!!!!!Handled ref change to second ref %s', second_ref);
              // At this point, the git_manager should have populated consul with both sample_key
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
  });
});