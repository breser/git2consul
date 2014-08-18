var should = require('should');
var _ = require('underscore');
var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');

require('./git2consul_bootstrap_test.js');

var ConsulClass = require('consul-node');
var consul = new ConsulClass();

describe('Test consul populate on clone', function() {
  it ('should handle a single file repo', function(done) {
    var sample_key = 'sample_key';
    var sample_value = 'test data';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Basic test.", function(err) {
      if (err) return done(err);
          
      git_manager.createGitManager(default_repo_config, function(err) {
        if (err) return done(err);
            
        // At this point, the git_manager should have populated consul with our sample_key
        consul.kv.get('/' + default_repo_config.name + '/master/' + sample_key, function(err, value) {
          if (err) return done(err);
          
          value[0].value.should.equal(sample_value);
          done();
        });
      });
    });
  });
  
  it ('should handle a multiple file repo', function(done) {
    var sample_key = 'sample_key';
    var sample_value = 'test data';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Basic test.", function(err) {
      if (err) return done(err);

      var sample_key2 = 'sample_key2';
      var sample_value2 = 'test data2';
      var default_repo_config = git_utils.createConfig().repos[0];
      git_utils.addFileToGitRepo(sample_key2, sample_value2, "Basic test.", function(err) {
        if (err) return done(err);
          
        git_manager.createGitManager(default_repo_config, function(err) {
          if (err) return done(err);
            
          // At this point, the git_manager should have populated consul with our sample_key
          consul.kv.get('/' + default_repo_config.name + '/master/' + sample_key, function(err, value) {
            if (err) return done(err);
          
            value[0].value.should.equal(sample_value);
            consul.kv.get('/' + default_repo_config.name + '/master/' + sample_key2, function(err, value) {
              if (err) return done(err);
              value[0].value.should.equal(sample_value2);
              done();
            });
          });
        });
      });
    });
  });
});