var should = require('should');
var _ = require('underscore');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('KV handling', function() {

  // The current copy of the git master branch.  This is initialized before each test in the suite.
  var branch;
  beforeEach(function(done) {

    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.
    git_utils.initRepo(function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      // Handle the initial sync of this repo.  Init adds a file to the remote repo, and this line syncs
      // that to our local cache and to consul.
      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        done();
      });
    });
  });

  var buffer_test = function(size, cb) {
    var buf = new Buffer(size);
    for (i=0; i<buf.length; ++i) {
      buf[i] = 'A';
    }

    git_utils.addFileToGitRepo("big_file", buf.toString(), "super big value test", function(err) {
      branch.handleRefChange(0, cb);
    });
  };

  it ('should accept values <= 512kB', function(done) {
    buffer_test(512*1024, function(err) {
      if (err) return done(err);

      // At this point, the repo should have populated consul with our sample_key
      consul_utils.getValue('test_repo/master/big_file', function(err, value) {
        if (err) return done(err);
        value.length.should.equal(512*1024);
        done();
      });
    });
  });

  it ('should reject values over 512kB', function(done) {
    buffer_test(513*1024, function(err) {
      err.should.not.equal(null);
      // Because the write was rejected, no KV will exist.
      consul_utils.validateValue('test_repo/master/big_file', undefined, function(err) {
        if (err) return done(err);
        done();
      });
    });

  });

  it ('should handle files with empty values', function(done) {
    var sample_key = 'sample_empty_value_key';
    var sample_value = '';
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file with an empty value.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/' + sample_key, sample_value, function(err, value) {
          if (err) return done(err);
          done();
        });
      });
    });
  });

});
