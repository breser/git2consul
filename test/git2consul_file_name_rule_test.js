var should = require('should');
var _ = require('underscore');

var path = require('path');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var mkdirp = require('mkdirp');

var consul_utils = require('./utils/consul_utils.js');

var Repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('file_name_rule', function() {

  it ('should create folders on consul by using file_name_rule fundtion', function(done) {

    // Create a remote git repo.  Then, init a Repo object with property file validate
    // that file are in the appropriate place in the Consul KV store by usning file naming
    // rule function.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      mkdirp(git_utils.TEST_REMOTE_REPO + "src/main/resources", function(cb) {
        if (err) return done(err);

        git_utils.addFileToGitRepo("src/main/resources/product-foundation-dev.properties", "default.connection.pool.db.url=jdbc:mysql://db-host:3306/product", "Db url added for dev environment.", function(err) {
          if (err) return done(err);

          var repo_config = git_utils.createRepoConfig();
          repo_config.source_root = "src/main/resources";
          repo_config.include_branch_name = false;
          repo_config.expand_keys = true;
          repo_config.file_name_rule = "var fileArr=file.split('.')[0].split('-');var fileName=fileArr.slice(0,fileArr.length-1).join('-');var fileEnv=fileArr[fileArr.length-1];return fileName.length==0?file:(fileName.concat(',').concat(fileEnv));";
          var repo = new Repo(repo_config);
          repo.init(function(err) {
            if (err) return done(err);
            consul_utils.validateValue('test_repo/product-foundation,dev/default.connection.pool.db.url', "jdbc:mysql://db-host:3306/product", function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

});
