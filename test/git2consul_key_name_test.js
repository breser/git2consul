var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

var git_commands = require('../lib/utils/git_commands.js');

var my_git_manager;

describe('Key names', function() {
  
  var default_repo_config = git_utils.createConfig().repos[0];

  beforeEach(function(done) {

    git_utils.addFileToGitRepo("iceice", "baby", "Init repo.", function(err) {
      if (err) return done(err);
      
      git_manager.createGitManager(default_repo_config, function(err, gm) {
        if (err) return done(err);
  
        my_git_manager = gm;
        done();
      });
    });
  });
      
  var default_repo_config = git_utils.createConfig().repos[0];
  
  var test_add = function(key_name, key_value) {
    return function(done) {
      git_utils.addFileToGitRepo(key_name, key_value, key_name + " key name test.", function(err) {
        if (err) return done(err);
      
        my_git_manager.getBranchManager('master').handleRefChange(0, function(err) {
          if (err) return done(err);
      
          // At this point, the git_manager should have populated consul with our sample_key
          consul_utils.getValue('/' + default_repo_config.name + '/master/' + key_name, function(err, value) {
            if (err) return done(err);
            value.should.equal(key_value);
            done();
          });    
        });
      });
    }
  };
  
  ['sample key', 'sample:key', 'sample;key', 'sample\\key', 'sample@key', 'sample!key'].forEach(function(key_name) {
    var sample_value = 'new test data';
    it ('with troublesome characters, like ' + key_name + ' work properly', test_add(key_name, sample_value));
  });
  
  
});
