var fs = require('fs');

var git_commands = require('../../lib/git/commands.js');
var git = require('../../lib/git');
var Repo = require('../../lib/git/repo.js');

exports.TEST_REMOTE_REPO = '/tmp/test_repo/';
exports.TEST_GITHUB_REPO = 'https://github.com/ryanbreen/git2consul_data.git';
exports.TEST_WORKING_DIR = '/tmp/test_workspace/';
exports.TEST_GITHUB_WORKING_DIR = '/tmp/test_github_workspace/';

var repo_counter = 0;

exports.createConfig = function() {
  return {
    local_store: exports.TEST_WORKING_DIR,
    repos: [
      exports.createRepoConfig()
    ]
  };
};

exports.createRepoConfig = function() {
  ++repo_counter;
  return {
    local_store: exports.TEST_WORKING_DIR,
    name: 'test_repo' + repo_counter,
    url: 'file://' + exports.TEST_REMOTE_REPO,
    branches: [ 'master' ]
  };
};

exports.initRepo = function(repo_config, cb) {

  if (!cb) {
    cb = repo_config;
    repo_config = exports.createRepoConfig();
  }

  git_commands.init(exports.TEST_REMOTE_REPO, function(err) {
    if (err) return cb(err);
    exports.addFileToGitRepo("readme.md", "Stub file to give us something to commit.", "Init repo.", false, function(err) {
      if (err) return cb(err);

      repo_config.local_store = exports.TEST_WORKING_DIR;
      exports.repo = new Repo(repo_config);
      git.repos[repo_config.name] = exports.repo;
      exports.repo.init(function(err) {
        if (err) return cb(err);

        cb(null);
      });
    });
  });
};

exports.addFileToGitRepo = function(name, content, commit_message, update, cb) {

  if (!cb) {
    cb = update;
    update = true;
  }

  fs.writeFile(exports.TEST_REMOTE_REPO + name, content, function(err) {
    if (err) return cb(err);

    git_commands.add(name, exports.TEST_REMOTE_REPO, function(err) {
      if (err) return cb(err);

      git_commands.commit(commit_message, exports.TEST_REMOTE_REPO, function(err) {
        if (err) return cb(err);

        if (update) {
          exports.repo.branches['master'].handleRefChange(0, function(err) {
            if (err) return cb(err);
            cb();
          });
        } else {
          cb();
        }
      });
    });
  });
};

exports.deleteFileFromGitRepo = function(name, commit_message, update, cb) {

  if (!cb) {
    cb = update;
    update = true;
  }

  git_commands.delete(name, exports.TEST_REMOTE_REPO, function(err) {
    if (err) return cb(err);

    git_commands.commit(commit_message, exports.TEST_REMOTE_REPO, function(err) {
      if (err) return cb(err);

      if (update) {
        exports.repo.branches['master'].handleRefChange(0, function(err) {
          if (err) return cb(err);
          cb();
        });
      } else {
        cb();
      }
    });
  });
};

exports.moveFileInGitRepo = function(old_name, new_name, commit_message, update, cb) {

  if (!cb) {
    cb = update;
    update = true;
  }

  git_commands.mv(old_name, new_name, exports.TEST_REMOTE_REPO, function(err) {
    if (err) return cb(err);

    git_commands.commit(commit_message, exports.TEST_REMOTE_REPO, function(err) {
      if (err) return cb(err);
      if (update) {
        exports.repo.branches['master'].handleRefChange(0, function(err) {
          if (err) return cb(err);
          cb();
        });
      } else {
        cb();
      }
    });
  });
};

exports.symlinkFileInGitRepo = function(link, referrent, commit_message, update, cb) {

  if (!cb) {
    cb = update;
    update = true;
  }

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
            if (update) {
              exports.repo.branches['master'].handleRefChange(0, function(err) {
                if (err) return cb(err);
                cb();
              });
            } else {
              cb();
            }
          });
        });
      })
    });
  });

};
