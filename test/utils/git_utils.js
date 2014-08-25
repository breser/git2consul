var fs = require('fs');

var git_commands = require('../../lib/utils/git_commands.js');

exports.TEST_REMOTE_REPO = '/tmp/test_repo/';
exports.TEST_WORKING_DIR = '/tmp/test_workspace/';

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
