var should = require('should');
var _ = require('underscore');

var mkdirp = require('mkdirp');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var git_manager = require('../lib/git_manager.js');
var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

var git_commands = require('../lib/utils/git_commands.js');

var my_git_manager;

describe('File operations', function() {

  var default_repo_config = git_utils.createConfig().repos[0];

  it ('should handle updates to a single file', function(done) {
    var sample_key = 'sample_key';
    var sample_value = 'new test data';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Update a file.", function(err) {
      if (err) return done(err);
      // At this point, the git_manager should have populated consul with our sample_key
      consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, sample_value, function(err, value) {
        if (err) return done(err);
        done();
      });
    });
  });

  it ('should handle additions of new files', function(done) {
    var sample_key = 'sample_new_key';
    var sample_value = 'new value';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);
      // At this point, the git_manager should have populated consul with our sample_key
      consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, sample_value, function(err, value) {
        if (err) return done(err);
        done();
      });
    });
  });

  it ('should handle deletions of existing files', function(done) {
    var sample_key = 'sample_new_key';
    var sample_value = 'new value';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create file to delete.", function(err) {
      if (err) return done(err);
      // At this point, the git_manager should have populated consul with our sample_key
      consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, sample_value, function(err, value) {
        if (err) return done(err);
        git_utils.deleteFileFromGitRepo(sample_key, "Delete file.", true, function(err) {
          if (err) return done(err);
          // At this point, the git_manager should have removed our sample_key
          consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, undefined, function(err, value) {
            if (err) return done(err);
            done();
          });
        });
      });
    });
  });

  it ('should handle moving an existing file', function(done) {
    var sample_key = 'sample_movable_key';
    var sample_moved_key = 'sample_moved_key';
    var sample_value = 'movable value';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create file to move.", function(err) {
      if (err) return done(err);
      // At this point, the git_manager should have populated consul with our sample_key
      consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, sample_value, function(err, value) {
        if (err) return done(err);
        git_utils.moveFileInGitRepo(sample_key, sample_moved_key, "Move file.", function(err) {
          if (err) return done(err);
          // At this point, the git_manager should have populated consul with our moved key, deleting the old name
          consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, undefined, function(err) {
            if (err) return done(err);
            // At this point, the git_manager should have populated consul with our moved key, adding the new name
            consul_utils.validateValue(default_repo_config.name + '/master/' + sample_moved_key, sample_value, function(err) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

  it ('should handle moving an existing file into a subfolder', function(done) {
    var sample_key = 'sample_movable_key';
    var sample_moved_key = 'subfolder/sample_moved_key';
    var sample_value = 'movable value';
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create file to move to subfolder.", function(err) {
      if (err) return done(err);
      // At this point, the git_manager should have populated consul with our sample_key
      consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, sample_value, function(err, value) {
        if (err) return done(err);
        mkdirp(git_utils.TEST_REMOTE_REPO + 'subfolder', function(err) {
          if (err) return done(err);
          git_utils.moveFileInGitRepo(sample_key, sample_moved_key, "Move file to subfolder.", function(err) {
            if (err) return done(err);
            // At this point, the git_manager should have populated consul with our moved key, deleting the old name
            consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, undefined, function(err) {
              if (err) return done(err);
              // At this point, the git_manager should have populated consul with our moved key, adding the new name
              consul_utils.validateValue(default_repo_config.name + '/master/' + sample_moved_key, sample_value, function(err) {
                if (err) return done(err);
                done();
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
    var default_repo_config = git_utils.createConfig().repos[0];
    git_utils.addFileToGitRepo(sample_key, sample_value, "Create file for symlinking.", function(err) {
      if (err) return done(err);
      // At this point, the git_manager should have populated consul with our sample_key
      consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, sample_value, function(err, value) {
        if (err) return done(err);
        git_utils.symlinkFileInGitRepo(sample_key, sample_referrent_file, "Change type of file.", function(err) {
          if (err) return done(err);
          // After symlinking, the consul KV should contain the symlink's name as a key and the symlinked file's contents as a value
          consul_utils.validateValue(default_repo_config.name + '/master/' + sample_key, sample_value, function(err) {
            if (err) return done(err);
            // The symlink's referrent should also appear in the KV store.
            consul_utils.validateValue(default_repo_config.name + '/master/' + sample_referrent_file, sample_value, function(err) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });
});
