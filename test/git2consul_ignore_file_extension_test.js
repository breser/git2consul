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
    repo_config.ignore_file_extension = true;
    done();
  });

  var test_files_known_extensions = {
    'ignore_file_extension/config_yaml.yaml': 'foo: bar',
    'ignore_file_extension/config_yml.yml': 'foo: bar',
    'ignore_file_extension/config_json.json': '{"foo": "bar"}',
    'ignore_file_extension/config_properties.properties': 'foo=bar',
  };

  var test_files_unknown_extensions = {
    'ignore_file_extension/config_ini.ini': 'foo = bar',
    'ignore_file_extension/config_toml.toml': 'foo = bar',
  };


  it ('should ignore file extension when expand_keys == true', function(done) {

    // Initialize a Repo and commit a properties file. Validate that the
    // expanded properties exist in the Consul KV store without a file
    // extension.
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      mkdirp(git_utils.TEST_REMOTE_REPO + 'ignore_file_extension', function(cb) {
        if (err) return done(err);

        git_utils.addFileToGitRepo("ignore_file_extension/user-service-dev.properties", "default.connection.pool.db.url=jdbc:mysql://db-host:3306/user", "User property file for dev environment added.", function(err) {
          if (err) return done(err);

          repo_config.expand_keys = true;
          var repo = new Repo(repo_config);

          repo.init(function(err) {
            if (err) return done(err);
            consul_utils.validateValue('test_repo/master/ignore_file_extension/user-service-dev/default.connection.pool.db.url', "jdbc:mysql://db-host:3306/user", function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

  it ('should not ignore file extension when expand_keys == false', function(done) {

    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      mkdirp(git_utils.TEST_REMOTE_REPO + 'ignore_file_extension', function(cb) {
        if (err) return done(err);

        git_utils.addFileToGitRepo('ignore_file_extension/user-service-dev.properties', "default.connection.pool.db.url=jdbc:mysql://db-host:3306/user", "User property file for dev environment added.", function(err) {
          if (err) return done(err);

          var repo = new Repo(repo_config);

          repo.init(function(err) {
            if (err) return done(err);
            consul_utils.validateValue('test_repo/master/ignore_file_extension/user-service-dev.properties', 'default.connection.pool.db.url=jdbc:mysql://db-host:3306/user', function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

  for (var filename in test_files_known_extensions) {
    (function(filename) {
      var contents = test_files_known_extensions[filename];
      var key_name = filename.substr(0, filename.lastIndexOf('.'));
      var extension = filename.substr(filename.lastIndexOf('.') + 1);
      it ('should remove file extension for known file type: ' + extension, function(done) {

        git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
          if (err) return done(err);

          mkdirp(git_utils.TEST_REMOTE_REPO + 'ignore_file_extension', function(cb) {
            if (err) return done(err);

            git_utils.addFileToGitRepo(filename, contents, 'Test data added: ' + filename, function(err) {
              if (err) return done(err);

              repo_config.expand_keys = true;
              var repo = new Repo(repo_config);

              repo.init(function(err) {
                if (err) return done(err);
                consul_utils.validateValue('test_repo/master/' + key_name + '/foo', 'bar', function(err, value) {
                  if (err) return done(err);
                  done();
                });
              });
            });
          });
        });
      });
    })(filename);
  }

  for (var filename in test_files_unknown_extensions) {
    (function(filename) {
      var contents = test_files_unknown_extensions[filename];
      var key_name = filename.substr(0, filename.lastIndexOf('.'));
      var extension = filename.substr(filename.lastIndexOf('.') + 1);
      it ('should not remove file extension for unknown file type: ' + extension, function(done) {

        git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
          if (err) return done(err);

          mkdirp(git_utils.TEST_REMOTE_REPO + 'ignore_file_extension', function(cb) {
            if (err) return done(err);

            git_utils.addFileToGitRepo(filename, contents, 'Test data added: ' + filename, function(err) {
              if (err) return done(err);

              repo_config.expand_keys = true;
              var repo = new Repo(repo_config);

              repo.init(function(err) {
                if (err) return done(err);
                consul_utils.validateValue('test_repo/master/' + key_name + '/foo', '', function(err, value) {
                  if (err) return done(err);
                  done();
                });
              });
            });
          });
        });
      });
    })(filename);
  }
});
