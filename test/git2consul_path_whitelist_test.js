var should = require('should');
var _ = require('underscore');

var fs = require('fs');
var path = require('path');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var mkdirp = require('mkdirp');

var consul_utils = require('./utils/consul_utils.js');

var Repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');

var git_commands = require('../lib/git/commands.js');

describe.only('path_whitelist', function() {

  // Set up common configuration fixture.
  var repo_config;
  beforeEach(function(done) {
    repo_config = git_utils.createRepoConfig();
    repo_config.name = "config";
    repo_config.include_branch_name = false;
    repo_config.path_whitelist = [
      "mycompany/staging/",
      "readme.md", // this is necessary because initRepo uses that file
    ];
    repo_config.hooks = [{
      'type': 'polling',
      'interval': '1'
    }];
    git_utils.initRepo(repo_config, function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  var bad_files_fixtures = [
    "TESTREADME.md",
    "mycompany/prod/test",
    "mycompany/staging2/blabla",
    "mycompany/staging2/test",
    "this/makes/no/sense",
  ];

  var good_files_fixtures = [
    "mycompany/staging/test",
    "mycompany/staging/some/very/nested/path",
  ];

  const FILE_CONTENT = "foo";

  var createDirectoryPath = function(filepath) {
    const pathparts = path.parse(filepath);
    return new Promise((res, rej) => {
      mkdirp(git_utils.TEST_REMOTE_REPO + pathparts.dir, function(err) {
        if (err) rej(err);
        res(filepath);
      });
    });
  }

  var createFakeFile = function(filepath) {
    return new Promise((res, rej) => {
      git_utils.addFileToGitRepo(filepath, FILE_CONTENT, "Writing commit messages all day long", function(err) {
        if (err) rej(err);
        res(filepath);
      });
    });
  }

  var validateFileContent = function(filepath, value) {
    return new Promise((res, rej) => {
      consul_utils.validateValue(repo_config.name + '/' + filepath, value, function(err) {
        if (err) rej(err);
        res();
      });
    });
  };

  var promiseWaitForValue = function(value) {
    return new Promise((res, rej) => {
      consul_utils.waitForValue(repo_config.name + '/' + value, function(err) {
        if (err) rej(err);
        res();
      });
    });
  }

  it('should create files that are in the whitelist', function() {
    var allFiles = good_files_fixtures.concat(bad_files_fixtures);
    var createAllDirs = () => Promise.all(allFiles.map(x => createDirectoryPath(x)));
    var createFiles = () => allFiles.reduce((chain, x) => {
        return chain.then(() => createFakeFile(x))
      }, Promise.resolve());
    var waitForFiles = () => Promise.all(good_files_fixtures.map(x => promiseWaitForValue(x)))
    var verifyGoodFiles = () => Promise.all(bad_files_fixtures.map(x => validateFileContent(x, null)))
    var verifyBadFiles = () => Promise.all(good_files_fixtures.map(x => validateFileContent(x, FILE_CONTENT)))

    return createAllDirs()
 	  .then(createFiles)
      .then(waitForFiles)
	  .then(verifyGoodFiles)
	  .then(verifyBadFiles)
  });
});
