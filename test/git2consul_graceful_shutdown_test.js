var should = require('should');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var git_manager = require('../lib/git_manager.js');

describe('Graceful Shutdown', function() {
  
  before(function() {
    git_manager.mock();
  });

  it ('should successfully fire if nothing else is happening', function(done) {
    git_manager.gracefulShutdown(function() {
      done();
    });
  });

  after(function() {
    git_manager.mock();
  });

});
