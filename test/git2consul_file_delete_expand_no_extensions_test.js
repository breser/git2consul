var should = require('should');
var _ = require('underscore');

var mkdirp = require('mkdirp');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('File operations', function() {

  // The current copy of the git master branch.  This is initialized before each test in the suite.
  var branch;
  beforeEach(function(done) {

    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.
      git_utils.initRepo(_.extend(git_utils.createRepoConfig(), {'expand_keys': true,"ignore_file_extension" : true}), function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  it ('should handle deletions of existing files - expand ignore file extensions', function(done) {
    var sample_key = 'simple.yaml';
    var sample_value = "---\n\nfirst_level:\n  second_level: is_all_we_need\n";

    // Add the file, call branch.handleRef to sync the commit, then delete the file and sync again.
    // Finally, validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create file to delete.", function(err) {
      if (err) return done(err);
      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // Validate that the file was added to consul before we delete it
        consul_utils.validateValue('test_repo/master/simple/first_level/second_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);
          branch.handleRefChange(0, function(err) {
            if (err) return done(err);
            git_utils.deleteFileFromGitRepo(sample_key, "Delete file.", function(err) {
              if (err) return done(err);
              branch.handleRefChange(0, function(err) {
                if (err) return done(err);
                // At this point, the branch should have removed our sample_key from consul.
                consul_utils.validateValue('test_repo/master/simple/first_level/second_level', undefined, function(err, value) {
                  if (err) return done(err);
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
