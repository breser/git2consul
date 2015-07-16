var _ = require('underscore');
var should = require('should');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var fs = require('fs');
var rimraf = require('rimraf');

var git = require('../lib/git/');
var git_commands = require('../lib/git/commands.js');
var Repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');

describe('Config Validation', function() {
  
  it ('should reject a repo with invalid config', function() {

    try {
      var repo = new Repo();
      should.fail("Repo with no config should throw an exception");
    } catch(e) {
      e.message.should.equal('No configuration provided for repo');
    }

    [{}, {'local_store':'/tmp/test_workspace'}, {'local_store':'/tmp/test_workspace', 'name':'incomplete'},
     {'local_store':'/tmp/test_workspace', 'name':'incomplete', 'branches': ['master']}].forEach(function(config) {
      try {
        var repo = new Repo(config);
        should.fail("Repo with incomplete config should throw an exception");
      } catch(e) {
        e.message.should.equal('A repo must have a local_store, a url, a name, and a branch array.');
      }
    });
  });

  it ('should reject a config using an existing repo name', function(done) {
    git_utils.initRepo(function(err, repo) {
      if (err) return done(err);
      var config = {
        local_store: git_utils.TEST_WORKING_DIR,
        repos: [git_utils.createRepoConfig(), git_utils.createRepoConfig()]
      };

      var callback_seen = false;
      git.createRepos(config, function(err) {
        err.should.equal("A repo with that name is already tracked.");
        if (callback_seen) {
          done();
        } else callback_seen = true;
      });
    });
  });

  it ('should reject a repo with a bogus local_store', function(done) {
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);
      var config = {
        local_store: "/var/permdenied",
        repos: [git_utils.createRepoConfig()]
      };

      var callback_seen = false;
      git.createRepos(config, function(err) {
        err.should.startWith("Failed to create local store");
        done();
      });
    });
  });

  it ('should reject a repo with a bogus mountpoint', function() {
    try {
      var repo = new Repo({'name': 'busted_mountpoint_repo', 'url': 'http://www.github.com/',
        'local_store':'/tmp/', 'branches': ['master'], 'mountpoint': '/oops'});
      should.fail("mountpoint must not start or end with /.");
    } catch(e) {
      e.message.should.equal('mountpoint must not start or end with /.');
    }

    try {
      var repo = new Repo({'name': 'busted_mountpoint_repo', 'url': 'http://www.github.com/',
        'local_store':'/tmp/', 'branches': ['master'], 'mountpoint': 'oops/'});
      should.fail("mountpoint must not start or end with /.");
    } catch(e) {
      e.message.should.equal('mountpoint must not start or end with /.');
    }
  });

  it ('should reject a repo with a non-existent local_store', function() {
    try {
      var repo = new Repo({'name': 'non_existent_local_store_repo', 'url': 'http://www.github.com/',
        'local_store':'/var/i_dont_live_here', 'branches': ['master']});
      should.fail("Repo with non-existent local_store should throw an exception");
    } catch(e) {
      e.message.should.equal('directory /var/i_dont_live_here does not exist');
    }
  });

  it ('should reject a repo with a non-writeable local_store', function() {
    try {
      fs.writeFileSync('/tmp/not_a_directory', 'oops');
      var repo = new Repo({'name': 'non_directory_local_store_repo', 'url': 'http://www.github.com/',
        'local_store':'/tmp/not_a_directory', 'branches': ['master']});
      should.fail("Repo with non-writeable local_store should throw an exception");
    } catch(e) {
      e.message.should.equal('/tmp/not_a_directory is not a directory');
    }

    try {
      rimraf.sync('/tmp/test_directory');
      fs.mkdirSync('/tmp/test_directory');
      fs.chmodSync('/tmp/test_directory', parseInt(555, 8));
      var repo = new Repo({'name': 'unwriteable_directory', 'url': 'http://www.github.com/',
        'local_store':'/tmp/test_directory', 'branches': ['master']});
      should.fail("Repo with non-writeable directory should throw an exception");
    } catch(e) {
      e.message.should.equal('/tmp/test_directory is not writeable');
    } finally {
      rimraf.sync('/tmp/test_directory');
    }
  });

  it ('should reject a repo with duplicate branches', function() {
    try {
      var repo = new Repo({'name': 'busted_dupe_branch_repo', 'url': 'http://www.github.com/',
        'local_store':'/tmp/test_workspace', 'branches': ['master', 'master', 'commander']});
      should.fail("Repo with duplicate branches should throw an exception");
    } catch(e) {
      e.message.should.startWith('Duplicate name found in branches for repo busted_dupe_branch_repo');
    }
  });

  it ('should reject a repo with no branches', function() {
    try {
      var repo = new Repo({'name': 'busted_empty_branch_repo', 'local_store':'/tmp/test_workspace',
        'url': 'http://www.github.com/', 'branches': []});
      should.fail("Repo with no branches should be denied.");
    } catch(e) {
      e.message.should.equal('No branches specified.');
    }
  });

  it ('should reject a repo with a broken git url', function(done) {
    var repo = new Repo(_.extend(git_utils.createRepoConfig(), { url: 'file:///tmp/nobody_home' }));
    repo.init(function(err) {
      err[0].message.should.containEql('does not appear to be a git repository');
      done();
    });
  });

  it ('should reject an invalid git hook type', function(done) {
    git_commands.init(git_utils.TEST_REMOTE_REPO, function(err) {
      if (err) return done(err);

      // When we create a repo, we need it to have an initial commit.  The call to addFile provides that.
      git_utils.addFileToGitRepo("readme.md", "Stub file to give us something to commit.", "Init repo.", function(err) {

        if (err) return cb(err);
        var config = {
          local_store: git_utils.TEST_WORKING_DIR,
          repos: [git_utils.createRepoConfig()]
        };

        config.repos[0].hooks = [{'type':'unknown'}];

        var callback_seen = false;
        git.createRepos(config, function(err) {
          err.should.startWith("Failed to load repo test_repo due to Invalid hook type unknown");
          done();
        });
      });
    });
  });
});
