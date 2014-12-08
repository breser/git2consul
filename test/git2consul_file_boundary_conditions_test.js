var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('KV handling', function() {

  var buffer_test = function(size, cb) {
    var buf = new Buffer(size);
    for (i=0; i<buf.length; ++i) {
      buf[i] = 'A';
    }

    git_utils.addFileToGitRepo("big_file", buf.toString(), "super big value test", cb);
  };

  it ('should accept values <= 512kB', function(done) {

    var repo_name = git_utils.repo.name;

    buffer_test(512*1024, function(err) {
      if (err) return done(err);

      // At this point, the repo should have populated consul with our sample_key
      consul_utils.getValue(repo_name + '/master/big_file', function(err, value) {
        if (err) return done(err);
        value.length.should.equal(512*1024);
        done();
      });
    });
  });

  it ('should reject values over 512kB', function(done) {

    var repo_name = git_utils.repo.name;

    buffer_test(513*1024, function(err) {
      err.should.not.equal(null);
      // Because the write was rejected, no KV will exist.
      consul_utils.validateValue(repo_name + '/master/big_file', undefined, function(err) {
        if (err) return done(err);
        done();
      });
    });

  });

  it ('should handle files with empty values', function(done) {

    var repo_name = git_utils.repo.name;
    var sample_key = 'sample_new_key';
    var sample_value = '';
    var default_repo_config = git_utils.createRepoConfig();
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);
      // At this point, the repo should have populated consul with our sample_key
      consul_utils.validateValue(repo_name + '/master/' + sample_key, sample_value, function(err, value) {
        if (err) return done(err);
        done();
      });
    });
  });

});
