var should = require('should');
var _ = require('underscore');

var mkdirp = require('mkdirp');

var logger = require('../lib/logging.js');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var repo = require('../lib/git/repo.js');
var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

var git_commands = require('../lib/git/commands.js');

describe('Expand keys', function() {

  // The current copy of the git master branch.  This is initialized before each test in the suite.
  var branch;
  beforeEach(function(done) {

    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.  These are all tests of expand_keys mode, so set that here.
    git_utils.initRepo(_.extend(git_utils.createRepoConfig(), {'expand_keys': true,"ignore_file_extension" : true}), function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  /*YAML*/

  it ('should handle additions of new YAML files when expand_keys and ignore_file_extensions set', function(done) {
    var sample_key = 'simple.yaml';
    var sample_value = "---\n\nfirst_level:\n  second_level: is_all_we_need\n";

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/simple/first_level/second_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);
          done();
        });
      });
    });
  });



  it ('should handle changing YAML files and not removing another key with suffix when expand_keys and ignore_file_extensions set', function(done) {
    var sample_key = 'changeme.yaml';
    var sample_value = "---\n\nfirst_level:\n  is_all_we_need\n";

    var sample_key2 = 'changeme_had-dev.yaml';
    var sample_value2 = "---\n\nfirst_level:\n  plikdwa\n";


    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);
		git_utils.addFileToGitRepo(sample_key2, sample_value2, "Add a file.", function(err) {
		if (err) return done(err);
		branch.handleRefChange(0, function(err) {
			if (err) return done(err);
			// At this point, the repo should have populated consul with our sample_key
			consul_utils.validateValue('test_repo/master/changeme/first_level', 'is_all_we_need', function(err, value) {
			  if (err) return done(err);

			  // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
			  git_utils.addFileToGitRepo(sample_key, "---\n\nfirst_level:\n  is super different\n", "Change a file.", function(err) {
				if (err) return done(err);

				branch.handleRefChange(0, function(err) {
				  if (err) return done(err);

				  // At this point, the repo should have populated consul with our sample_key
				  consul_utils.validateValue('test_repo/master/changeme/first_level', 'is super different', function(err, value) {
					if (err) return done(err);

					consul_utils.validateValue('test_repo/master/changeme_had-dev/first_level', 'plikdwa', function(err, value) {
						if (err) return done(err);
							done();						
					});
				  });
				});
			  });
			});

		    });
		});	  
    });
	
  });




});
