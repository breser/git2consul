var fs = require('fs');

var git_commands = require('../../lib/git/commands.js');
var git = require('../../lib/git');
var Repo = require('../../lib/git/repo.js');

exports.TEST_REMOTE_REPO = '/tmp/test_repo/';
exports.TEST_WORKING_DIR = '/tmp/test_workspace/';

exports.createRepoConfig = function() {
  return {
    local_store: exports.TEST_WORKING_DIR,
    name: 'test_repo',
    url: 'file://' + exports.TEST_REMOTE_REPO,
    branches: [ 'master' ]
  };
};

/**
 * Initialize a repo and return it in a callback.
 */
exports.initRepo = function(repo_config, cb) {

  if (!cb) {
    cb = repo_config;
    repo_config = exports.createRepoConfig();
  }

  git_commands.init(exports.TEST_REMOTE_REPO, function(err) {
    if (err) return cb(err);

    // When we create a repo, we need it to have an initial commit.  The call to addFile provides that.
    exports.addFileToGitRepo("readme.md", "Stub file to give us something to commit.", "Init repo.", function(err) {
      if (err) return cb(err);

      repo_config.local_store = exports.TEST_WORKING_DIR;
      var repo = new Repo(repo_config);

      // Register this repo such that graceful shutdown checks in the git module work.
      git.repos[repo_config.name] = repo;

      repo.init(function(err) {
        if (err) return cb(err);

        cb(null, repo);
      });
    });
  });
};

exports.addFileToGitRepo = function(name, content, commit_message, cb) {

  fs.writeFile(exports.TEST_REMOTE_REPO + name, content, function(err) {
    if (err) return cb(err);

    git_commands.add(name, exports.TEST_REMOTE_REPO, function(err) {
      if (err) return cb(err);

      git_commands.commit(commit_message, exports.TEST_REMOTE_REPO, function(err) {
        if (err) return cb(err);
        cb();
      });
    });
  });
};

exports.deleteFileFromGitRepo = function(name, commit_message, cb) {

  git_commands.delete(name, exports.TEST_REMOTE_REPO, function(err) {
    if (err) return cb(err);

    git_commands.commit(commit_message, exports.TEST_REMOTE_REPO, function(err) {
      if (err) return cb(err);
      cb();
    });
  });
};

exports.moveFileInGitRepo = function(old_name, new_name, commit_message, cb) {

  git_commands.mv(old_name, new_name, exports.TEST_REMOTE_REPO, function(err) {
    if (err) return cb(err);

    git_commands.commit(commit_message, exports.TEST_REMOTE_REPO, function(err) {
      if (err) return cb(err);
      cb();
    });
  });
};

exports.symlinkFileInGitRepo = function(link, referrent, commit_message, cb) {

  fs.rename(exports.TEST_REMOTE_REPO + link, exports.TEST_REMOTE_REPO + referrent, function(err) {
    if (err) return cb(err);

    fs.symlink(exports.TEST_REMOTE_REPO + referrent, exports.TEST_REMOTE_REPO + link, function(err) {
      if (err) return cb(err);

      git_commands.add(link, exports.TEST_REMOTE_REPO, function(err) {
        if (err) return cb(err);

        git_commands.add(referrent, exports.TEST_REMOTE_REPO, function(err) {
          if (err) return cb(err);

          git_commands.commit(commit_message, exports.TEST_REMOTE_REPO, function(err) {
            if (err) return cb(err);
            cb();
          });
        });
      })
    });
  });

};
