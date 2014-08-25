var _ = require('underscore');
var should = require('should');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');

describe('Config Validation', function() {
  
  beforeEach(function(done) {
    git_utils.addFileToGitRepo('sample', 'wample', 'starter home', function(err) {
      done();
    });    
  });
  
  it ('should reject a config with no repos', function(done) {
    var count = 3;    
    git_manager.createGitManagers(null, function(err) {
      err.should.equal('No array of repo configs provided');
      --count;
      if (count === 0) done();
    });
    git_manager.createGitManagers({}, function(err) {
      err.should.equal('No array of repo configs provided');
      --count;
      if (count === 0) done();
    });
    git_manager.createGitManagers([], function(err) {
      err.should.equal('No array of repo configs provided');
      --count;
      if (count === 0) done();
    });
  });
  
  it ('should reject a repo with no branches', function(done) {
    git_manager.createGitManager({}, function(err) {
      err.should.equal('No branches specified');
      done();
    });
  });
  
  it ('should reject a repo with a bogus local_store', function(done) {
    git_manager.createGitManager({'branches': ['master'], 'local_store': '/var/permdenied'}, function(err) {
      err.should.startWith('Failed to create root_directory for git manager:');
      done();
    });
  });
  
  it ('should reject a repo with a broken git url', function(done) {
    git_manager.createGitManager(_.extend(git_utils.createConfig().repos[0], { url: 'file:///tmp/nobody_home' }), function(err) {
      err.should.startWith('Failed to create manager for branch master');
      done();
    });
  });
  
  it ('should reject an invalid git hook type', function(done) {
    git_manager.createGitManager(_.extend(git_utils.createConfig().repos[0], { hooks: [ { 'type': 'unknown' }] }), function(err, gm) {
      err[0].should.startWith('Invalid hook type');
      done();
    });
  });
});