var fs = require('fs');

var git_commands = require('../../lib/utils/git_commands.js');
var git_manager = require('../../lib/git_manager.js');

exports.TEST_REMOTE_REPO = '/tmp/test_repo/';
exports.TEST_GITHUB_REPO = 'git@github.com:ryanbreen/git2consul_data.git';
exports.TEST_WORKING_DIR = '/tmp/test_workspace/';
exports.TEST_GITHUB_WORKING_DIR = '/tmp/test_github_workspace/';

exports.createConfig = function() {
  return {
    version: '1.0',
    repos: [{
      name: 'test_repo',
      local_store: exports.TEST_WORKING_DIR,
      url: 'file://' + exports.TEST_REMOTE_REPO,
      branches: [ 'master' ]
    }]
  };
};

exports.initRepo = function(name, cb) {

  git_commands.init(exports.TEST_REMOTE_REPO, function(err) {
    if (err) return cb(err);
    exports.addFileToGitRepo("readme.md", "Stub file to give us something to commit.", "Init repo.", false, function(err) {
      if (err) return cb(err);

      git_manager.manageRepo(exports.createConfig().repos[0], function(err, gm) {
        if (err) return cb(err);

        exports.GM = gm;
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
          exports.GM.getBranchManager('master').handleRefChange(0, function(err) {
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
        exports.GM.getBranchManager('master').handleRefChange(0, function(err) {
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
        exports.GM.getBranchManager('master').handleRefChange(0, function(err) {
          if (err) return cb(err);
          cb();
        });
      } else {
        cb();
      }
    });
  });
};
