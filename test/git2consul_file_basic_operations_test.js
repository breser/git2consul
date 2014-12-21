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
    git_utils.initRepo(function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  it ('should handle additions of new files', function(done) {
    var sample_key = 'sample_key_to_add';
    var sample_value = 'i like turtles';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/' + sample_key, sample_value, function(err, value) {
          if (err) return done(err);
          done();
        });
      });
    });
  });

  it ('should handle additions of multiple files', function(done) {
    var sample_key = 'sample_first_key_to_add';
    var sample_value = 'i like turtles';
    var sample_key2 = 'sample_second_key_to_add';
    var sample_value2 = 'i (still) like turtles';

    // Add the files, call branch.handleRef to sync the commits, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);
      git_utils.addFileToGitRepo(sample_key2, sample_value2, "Add another file.", function(err) {
        if (err) return done(err);

        branch.handleRefChange(0, function(err) {
          if (err) return done(err);
          // At this point, the repo should have populated consul with our sample_keys
          consul_utils.validateValue('test_repo/master/' + sample_key, sample_value, function(err, value) {
            if (err) return done(err);          
            // At this point, the repo should have populated consul with our sample_keys
            consul_utils.validateValue('test_repo/master/' + sample_key2, sample_value2, function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

  it ('should handle updates to a single file', function(done) {
    var sample_key = 'sample_key_to_update';
    var sample_value = 'i like turtles';

    // Add the file, call branch.handleRef to sync the commit, then do it all again with a different value.
    // Finally, validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);
      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // Change the value we commit to the remote end.
        sample_value = 'i really like turtles';
        git_utils.addFileToGitRepo(sample_key, sample_value, "Update a file.", function(err) {
          if (err) return done(err);
          branch.handleRefChange(0, function(err) {
            if (err) return done(err);
            consul_utils.validateValue('test_repo/master/' + sample_key, sample_value, function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

  it ('should handle deletions of existing files', function(done) {
    var sample_key = 'sample_key_to_delete';
    var sample_value = 'secret!';

    // Add the file, call branch.handleRef to sync the commit, then delete the file and sync again.
    // Finally, validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create file to delete.", function(err) {
      if (err) return done(err);
      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // Validate that the file was added to consul before we delete it
        consul_utils.validateValue('test_repo/master/' + sample_key, sample_value, function(err, value) {
          if (err) return done(err);
          branch.handleRefChange(0, function(err) {
            if (err) return done(err);
            git_utils.deleteFileFromGitRepo(sample_key, "Delete file.", function(err) {
              if (err) return done(err);
              branch.handleRefChange(0, function(err) {
                if (err) return done(err);
                // At this point, the branch should have removed our sample_key from consul.
                consul_utils.validateValue('test_repo/master/' + sample_key, undefined, function(err, value) {
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

  it ('should handle moving an existing file', function(done) {
    var sample_key = 'sample_movable_key';
    var sample_moved_key = 'sample_moved_key';
    var sample_value = 'movable value';

    // Add the file, call branch.handleRef to sync the commit, then move the file and sync again.
    // Finally, validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create file to move.", function(err) {
      if (err) return done(err);
      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // Validate that the file was added to consul before we move it
        consul_utils.validateValue('test_repo/master/' + sample_key, sample_value, function(err, value) {
          if (err) return done(err);
          git_utils.moveFileInGitRepo(sample_key, sample_moved_key, "Move file.", function(err) {
            if (err) return done(err);      
            branch.handleRefChange(0, function(err) {
              if (err) return done(err);
              // At this point, the repo should have populated consul with our moved key, deleting the old name
              consul_utils.validateValue('test_repo/master/' + sample_key, undefined, function(err) {
                if (err) return done(err);
                // At this point, the repo should have populated consul with our moved key, adding the new name
                consul_utils.validateValue('test_repo/master/' + sample_moved_key, sample_value, function(err) {
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

  it ('should handle moving an existing file into a subfolder', function(done) {
    var sample_key = 'sample_wrong_directory_key';
    var sample_moved_key = 'subfolder/sample_right_directory_key';
    var sample_value = 'movable value';

    // Add the file, call branch.handleRef to sync the commit, then move the file and sync again.
    // Finally, validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create file to move to subfolder.", function(err) {
      if (err) return done(err);
      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // Validate that the file was added to consul before we move it
        consul_utils.validateValue('test_repo/master/' + sample_key, sample_value, function(err, value) {
          if (err) return done(err);
          // Create the subdirectory in the remote repo.
          mkdirp(git_utils.TEST_REMOTE_REPO + 'subfolder', function(err) {
            if (err) return done(err);
            // Move the key to the subdirectory.
            git_utils.moveFileInGitRepo(sample_key, sample_moved_key, "Move file to subfolder.", function(err) {
              if (err) return done(err);
              branch.handleRefChange(0, function(err) {
                if (err) return done(err);
                // At this point, the repo should have populated consul with our moved key, deleting the old name
                consul_utils.validateValue('test_repo/master/' + sample_key, undefined, function(err) {
                  if (err) return done(err);
                  // At this point, the repo should have populated consul with our moved key, adding the new name
                  consul_utils.validateValue('test_repo/master/' + sample_moved_key, sample_value, function(err) {
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

  it ('should handle changing an existing file into a symlink', function(done) {
    var sample_key = 'some_day_i_will_by_a_symlink';
    var sample_referrent_file = 'referrent_file';
    var sample_value = 'linked value';

    // Add the file, call branch.handleRef to sync the commit, then convert the file to a symlink and
    // sync again.  Finally, validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create file for symlinking.", function(err) {
      if (err) return done(err);
      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/' + sample_key, sample_value, function(err, value) {
          if (err) return done(err);
          git_utils.symlinkFileInGitRepo(sample_key, sample_referrent_file, "Change type of file.", function(err) {
            if (err) return done(err);        
            branch.handleRefChange(0, function(err) {
              if (err) return done(err);
              // After symlinking, the consul KV should contain the symlink's name as a key and the symlinked file's contents as a value
              consul_utils.validateValue('test_repo/master/' + sample_key, sample_value, function(err) {
                if (err) return done(err);
                // The symlink's referrent should also appear in the KV store.
                consul_utils.validateValue('test_repo/master/' + sample_referrent_file, sample_value, function(err) {
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
