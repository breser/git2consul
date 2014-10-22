var _ = require('underscore');
var should = require('should');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');

describe('Config Validation', function() {

  it ('should reject a config with no repos', function(done) {
    var count = 3;
    git_manager.manageRepos(null, function(err) {
      err.should.equal('No array of repo configs provided');
      --count;
      if (count === 0) done();
    });
    git_manager.manageRepos({}, function(err) {
      err.should.equal('No array of repo configs provided');
      --count;
      if (count === 0) done();
    });
    git_manager.manageRepos([], function(err) {
      err.should.equal('No array of repo configs provided');
      --count;
      if (count === 0) done();
    });
  });

  it ('should reject a config with duplicate repo names', function(done) {
    git_manager.manageRepos([{'name': 'test_repo'}, {'name': 'test_repo'}, {'name': 'github_test_repo'}], function(err) {
      err.should.startWith('Duplicate name found in repos');
      done();
    });
  });

  it ('should reject a repo with duplicate branch names', function(done) {
    git_manager.manageRepo({}, function(err) {
      err.should.equal('No branches specified');
      done();
    });
  });

  it ('should reject a repo with no branches', function(done) {
    git_manager.manageRepo({}, function(err) {
      err.should.equal('No branches specified');
      done();
    });
  });

  it ('should reject a repo with duplicate branches', function(done) {
    git_manager.manageRepo({'name': 'busted_repo', 'branches': ['master', 'master', 'commander']}, function(err) {
      err.should.startWith('Duplicate name found in branches for repo busted_repo');
      done();
    });
  });

  it ('should reject a repo with a bogus local_store', function(done) {
    git_manager.manageRepo({'branches': ['master'], 'local_store': '/var/permdenied'}, function(err) {
      err.should.startWith('Failed to create root_directory for git manager:');
      done();
    });
  });

  it ('should reject a repo with a broken git url', function(done) {
    git_manager.manageRepo(_.extend(git_utils.createRepoConfig(), { local_store:'/tmp/busted', url: 'file:///tmp/nobody_home' }), function(err) {
      err.should.startWith('Failed to create manager for branch master');
      done();
    });
  });

  it ('should reject an invalid git hook type', function(done) {
    git_manager.manageRepo(_.extend(git_utils.createRepoConfig(), { hooks: [ { 'type': 'unknown' }] }), function(err, gm) {
      err[0].should.startWith('Invalid hook type');
      done();
    });
  });

  it ('should handle config validation if multiple repos initialized at the same time', function(done) {
    git_manager.manageRepos([_.extend(git_utils.createRepoConfig(), { hooks: [ { 'type': 'unknown' }] })], function(err, gm) {
      err[0][0].should.startWith('Invalid hook type');
      done();
    });
  });
});
