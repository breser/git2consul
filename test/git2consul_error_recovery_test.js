var should = require('should');
var _ = require('underscore');

var path = require('path');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var consul_utils = require('./utils/consul_utils.js');

var git = require('../lib/git');
var Repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/git/commands.js');

var exec = require('child_process').exec;

var logger = require('../lib/logging.js');

/*
 * Run a command.  If it fails, return the failure message as the first parameter
 * of the callback.  If it succeeds, return a null first parameter and a trimmed
 * stdout as the second parameter.
 */
var run_command = function(cmd, cwd, cb) {
  logger.trace('Running %s in %s', cmd, cwd);
  var child = exec(cmd, {cwd: cwd}, function(err, stdout, stderr) {
    if (stdout) stdout = stdout.trim();
    if (stderr) stderr = stderr.trim();

    if (stdout.length > 0) logger.trace("stdout:\n" + stdout);
    if (stderr.length > 0) logger.trace("stderr:\n" + stderr);

    if (err) {
      return cb(new Error(err + ' ' + stderr));
    }

    cb(null, stdout);
  });
};

describe('git2consul error recovery', function() {

  it ('should gracefully handle a pull of a branch polluted by a merge conflict', function(done) {

    // Create a remote git repo.  Then, force a push to really make that repo unhappy.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      git_utils.addFileToGitRepo("readme.md", "Test file in a known state", "Test commit.", function(err) {
        if (err) return done(err);

        var repo_config = git_utils.createRepoConfig();
        var repo = new Repo(repo_config);

        repo.init(function(err) {

          consul_utils.validateValue('test_repo/master/readme.md', "Test file in a known state", function(err, value) {
            if (err) return done(err);
  
            // The default repo created by initRepo has a single branch, master.
            branch = repo.branches['master'];

            git_utils.addFileToGitRepo("readme.md", "Test file in an even more known state", "Test commit.", function(err) {

              branch.handleRefChange(0, function(err) {
                if (err) return done(err);
                consul_utils.validateValue('test_repo/master/readme.md', "Test file in an even more known state", function(err, value) {
                  if (err) return done(err);

                  // Now revert to a previous commit and commit a new change.
                  run_command('git reset --hard HEAD~1', git_utils.TEST_REMOTE_REPO, function(err) {
                    if (err) return done(err);

                    git_utils.addFileToGitRepo("readme.md", "Force merge conflict", "Test commit.", function(err) {

                      // This ref change will attempt to pull the new state of TEST_REMOTE_REPO, but
                      // this will fail since it's impossible to do a clean merge.  git2consul should
                      // detect this and rebuild the branch.
                      branch.handleRefChange(0, function(err) {
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
    });
  });

  it ('should gracefully handle init of a branch polluted by a merge conflict', function(done) {

    // Create a remote git repo.  Then, force a push to really make that repo unhappy.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      git_utils.addFileToGitRepo("readme.md", "Test file in a known state", "Test commit.", function(err) {
        if (err) return done(err);

        var repo_config = git_utils.createRepoConfig();
        var repo = new Repo(repo_config);

        repo.init(function(err) {

          // The default repo created by initRepo has a single branch, master.
          branch = repo.branches['master'];

          consul_utils.validateValue('test_repo/master/readme.md', "Test file in a known state", function(err, value) {
            if (err) return done(err);
  
            git_utils.addFileToGitRepo("readme.md", "Test file in an even more known state", "Test commit.", function(err) {

              branch.handleRefChange(0, function(err) {
                if (err) return done(err);
                consul_utils.validateValue('test_repo/master/readme.md', "Test file in an even more known state", function(err, value) {
                  if (err) return done(err);

                  // Now revert to a previous commit and commit a new change.
                  run_command('git reset --hard HEAD~1', git_utils.TEST_REMOTE_REPO, function(err) {
                    if (err) return done(err);

                    git_utils.addFileToGitRepo("readme.md", "Force merge conflict", "Test commit.", function(err) {

                      // This ref change will attempt to pull the new state of TEST_REMOTE_REPO, but
                      // this will fail since it's impossible to do a clean merge.  git2consul should
                      // detect this and rebuild the branch.
                      repo.init(function(err) {
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
    });
  });

});
