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

describe('ignore_file_extension', function() {

  // Set up common configuration fixture.
  var repo_config;
  beforeEach(function(done) {
    repo_config = git_utils.createRepoConfig();
    repo_config.source_root = "src/main/resources";
    repo_config.ignore_file_extension = true;
    done();
  });

  it ('should create folders on consul without file extension', function(done) {

    // Create a remote git repo.  Then, init a Repo object with property file validate
    // that file are in the appropriate place in the Consul KV store without file extension.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      mkdirp(git_utils.TEST_REMOTE_REPO + "src/main/resources", function(cb) {
        if (err) return done(err);

        git_utils.addFileToGitRepo("src/main/resources/user-service-dev.properties", "default.connection.pool.db.url=jdbc:mysql://db-host:3306/user", "User property file for dev environment added.", function(err) {
          if (err) return done(err);

          repo_config.expand_keys = true;
          var repo = new Repo(repo_config);

          repo.init(function(err) {
            if (err) return done(err);
            consul_utils.validateValue('test_repo/master/user-service-dev/default.connection.pool.db.url', "jdbc:mysql://db-host:3306/user", function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

});
