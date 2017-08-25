var should = require('should');
var _ = require('underscore');

var mkdirp = require('mkdirp');

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
    git_utils.initRepo(_.extend(git_utils.createRepoConfig(), {'expand_keys': true}), function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  /*JSON*/
  it ('should handle additions of new JSON files', function(done) {
    var sample_key = 'simple.json';
    var sample_value = '{ "first_level" : { "second_level": "is_all_we_need" } }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/simple.json/first_level/second_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);
          done();
        });
      });
    });
  });

  it ('should handle changing JSON files', function(done) {
    var sample_key = 'changeme.json';
    var sample_value = '{ "first_level" : "is_all_we_need" }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/changeme.json/first_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);

          // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
          git_utils.addFileToGitRepo(sample_key, '{ "first_level" : "is super different" }', "Change a file.", function(err) {
            if (err) return done(err);

            branch.handleRefChange(0, function(err) {
              if (err) return done(err);

              // At this point, the repo should have populated consul with our sample_key
              consul_utils.validateValue('test_repo/master/changeme.json/first_level', 'is super different', function(err, value) {
                if (err) return done(err);

                done();
              });
            });
          });
        });
      });
    });
  });

  it ('should handle busted JSON files', function(done) {
    var sample_key = 'busted.json';
    var sample_value = '{ "busted" ; "json" }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/busted.json', sample_value, function(err, value) {
          if (err) return done(err);

          // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
          git_utils.addFileToGitRepo(sample_key, '{ "not_busted" : "json" }', "Change a file.", function(err) {
            if (err) return done(err);

            branch.handleRefChange(0, function(err) {
              if (err) return done(err);

              // At this point, the repo should have populated consul with our sample_key
              consul_utils.validateValue('test_repo/master/busted.json/not_busted', 'json', function(err, value) {
                if (err) return done(err);

                done();
              });
            });
          });
        });
      });
    });
  });

  it ('should handle JSON files with special characters', function(done) {
    var sample_key = 'special.json';
    var sample_value = {
      "fuzzy" : {
        "second level": "ain\'t no one got time for that",
        "second/level": {
          "ok?": "yes"
        }
      }
    };

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, JSON.stringify(sample_value), "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/special.json/fuzzy/second%20level', sample_value['fuzzy']['second level'], function(err, value) {
          // At this point, the repo should have populated consul with our sample_key
          consul_utils.validateValue('test_repo/master/special.json/fuzzy/second%2Flevel/ok%3F', sample_value['fuzzy']['second/level']['ok?'], function(err, value) {
            if (err) return done(err);
            done();
          });
        });
      });
    });
  });

  /*YAML*/

  it ('should handle additions of new YAML files', function(done) {
    var sample_key = 'simple.yaml';
    var sample_value = "---\n\nfirst_level:\n  second_level: is_all_we_need\n";

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/simple.yaml/first_level/second_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);
          done();
        });
      });
    });
  });

  it ('should handle changing YAML files', function(done) {
    var sample_key = 'changeme.yaml';
    var sample_value = "---\n\nfirst_level:\n  is_all_we_need\n";

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/changeme.yaml/first_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);

          // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
          git_utils.addFileToGitRepo(sample_key, "---\n\nfirst_level:\n  is super different\n", "Change a file.", function(err) {
            if (err) return done(err);

            branch.handleRefChange(0, function(err) {
              if (err) return done(err);

              // At this point, the repo should have populated consul with our sample_key
              consul_utils.validateValue('test_repo/master/changeme.yaml/first_level', 'is super different', function(err, value) {
                if (err) return done(err);

                done();
              });
            });
          });
        });
      });
    });
  });

  it ('should handle busted YAML files', function(done) {
    var sample_key = 'busted.yaml';
    // from: js-yaml / test / samples-load-errors / forbidden-value.yml
    var sample_value = "---\n\ntest: key: value\n";

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/busted.yaml', "---\n\ntest: key: value", function(err, value) {
          if (err) return done(err);

          // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
          git_utils.addFileToGitRepo(sample_key, "---\n\nnot_busted: yaml\n", "Change a file.", function(err) {
            if (err) return done(err);

            branch.handleRefChange(0, function(err) {
              if (err) return done(err);

              // At this point, the repo should have populated consul with our sample_key
              consul_utils.validateValue('test_repo/master/busted.yaml/not_busted', 'yaml', function(err, value) {
                if (err) return done(err);

                done();
              });
            });
          });
        });
      });
    });
  });

  it ('should handle YAML files with special characters', function(done) {
    var sample_key = 'special.yaml';
    var sample_value = "---\n\nfuzzy:\n  second level: ain\'t no one got time for that\n  second/level:\n    ok?: yes\n";

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);

        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/special.yaml/fuzzy/second%20level', "ain\'t no one got time for that", function(err, value) {
          // At this point, the repo should have populated consul with our sample_key
          consul_utils.validateValue('test_repo/master/special.yaml/fuzzy/second%2Flevel/ok%3F', 'yes', function(err, value) {
            if (err) return done(err);
            done();
          });
        });
      });
    });
  });

  /*properties*/

  it ('should handle additions of new properties files', function(done) {
    var sample_key = 'simple.properties';
    var sample_value = 'foo=bar';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/simple.properties/foo', 'bar', function(err, value) {
          if (err) return done(err);
          done();
        });
      });
    });
  });

  it ('should handle changing properties files', function(done) {
    var sample_key = 'changeme.properties';
    var sample_value = 'foo=bar';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/changeme.properties/foo', 'bar', function(err, value) {
          if (err) return done(err);

          // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
          git_utils.addFileToGitRepo(sample_key, 'foo=different_bar', "Change a file.", function(err) {
            if (err) return done(err);

            branch.handleRefChange(0, function(err) {
              if (err) return done(err);

              // At this point, the repo should have populated consul with our sample_key
              consul_utils.validateValue('test_repo/master/changeme.properties/foo', 'different_bar', function(err, value) {
                if (err) return done(err);

                done();
              });
            });
          });
        });
      });
    });
  });

  it ('should handle busted properties files', function(done) {
    var sample_key = 'busted.properties';
     //the parser is quite tolerant to syntax.
     //the best way to test this case is by using an unset variable, which will throw an error when accessed.
    var sample_value = 'foo=${bar}';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/busted.properties', sample_value, function(err, value) {
          if (err) return done(err);

          // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
          git_utils.addFileToGitRepo(sample_key, 'foo=bar', "Change a file.", function(err) {
            if (err) return done(err);

            branch.handleRefChange(0, function(err) {
              if (err) return done(err);

              // At this point, the repo should have populated consul with our sample_key
              consul_utils.validateValue('test_repo/master/busted.properties/foo', 'bar', function(err, value) {
                if (err) return done(err);

                done();
              });
            });
          });
        });
      });
    });
  });

  /* common */
  it ('should handle different files commingled together', function(done) {
    var json_key = 'happy.json';
    var json_value = '{ "happy" : "json" }';
    var property_key = 'simple.properties';
    var property_value = 'foo=bar';
    var sample_key = 'not_a_json_key';
    var sample_value = 'password: calvin12345';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(json_key, json_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);

        // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
        git_utils.addFileToGitRepo(sample_key, sample_value, "Add another file.", function(err) {
          if (err) return done(err);

          branch.handleRefChange(0, function(err) {
            if (err) return done(err);

            // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
            git_utils.addFileToGitRepo(property_key, property_value, "Add another file.", function(err) {
              if (err) return done(err);

              branch.handleRefChange(0, function(err) {
                if (err) return done(err);

                // At this point, the repo should have populated consul with our sample_key
                consul_utils.validateValue('test_repo/master/happy.json/happy', 'json', function(err, value) {
                  if (err) return done(err);

                  // At this point, the repo should have populated consul with our sample_key
                  consul_utils.validateValue('test_repo/master/simple.properties/foo', 'bar', function(err, value) {
                    if (err) return done(err);

                    // At this point, the repo should have populated consul with our sample_key
                    consul_utils.validateValue('test_repo/master/not_a_json_key', sample_value, function(err, value) {
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
});

describe('Expand keys with common properties', function() {

  // The current copy of the git master branch.  This is initialized before each test in the suite.
  var branch;
  beforeEach(function(done) {

    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.  These are all tests of expand_keys mode, so set that here.
    git_utils.initRepo(_.extend(git_utils.createRepoConfig(), {'expand_keys': true, 'common_properties': "common.properties"}), function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  it('should handle simple common-properties injection', function(done) {
    var common_key = 'common.properties';
    var common_value = 'bar=bar';
    var sample_key = 'simple.properties';
    var sample_value = 'foo=${bar}';

    git_utils.addFileToGitRepo(common_key, common_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {

        git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
          if (err) return done(err);

          branch.handleRefChange(0, function(err) {
            if (err) return done(err);

            consul_utils.validateValue('test_repo/master/simple.properties/foo', 'bar', function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

  it('should store as flat file if unset property', function(done) {
    var common_key = 'common.properties';
    var common_value = 'bar=bar';
    var sample_key = 'simple.properties';
    var sample_value = 'foo=${unset}';

    git_utils.addFileToGitRepo(common_key, common_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {

        git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
          if (err) return done(err);

          branch.handleRefChange(0, function(err) {
            if (err) return done(err);

            consul_utils.validateValue('test_repo/master/simple.properties', sample_value, function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

  it('should store as flat file if common properties file is invalid / not found', function(done) {
    var sample_key = 'simple.properties';
    var sample_value = 'foo=${unset}';

        git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
          if (err) return done(err);

          branch.handleRefChange(0, function(err) {
            if (err) return done(err);

            consul_utils.validateValue('test_repo/master/simple.properties', sample_value, function(err, value) {
              if (err) return done(err);
              done();
            });
      });
    });
  });


  it('should update the dependent properties file if common is updated', function(done) {
    var common_file = 'common.properties';
    var common_kv = 'bar=bar';

    var sample_file = 'simple.properties';
    var sample_kv = 'foo=${bar}';

    var updated_common_kv = 'bar=bar_updated';

    git_utils.addFileToGitRepo(common_file, common_kv, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {

        git_utils.addFileToGitRepo(sample_file, sample_kv, "Add a file.", function(err) {
          if (err) return done(err);

          branch.handleRefChange(0, function(err) {
            if (err) return done(err);

            consul_utils.validateValue('test_repo/master/simple.properties/foo', 'bar', function(err, value) {
              if (err) return done(err);

              git_utils.addFileToGitRepo(common_file, updated_common_kv, "Add a file.", function(err) {
                if (err) return done(err);

                branch.handleRefChange(0, function(err) {
                  if (err) return done(err);

                  consul_utils.validateValue('test_repo/master/simple.properties/foo', 'bar_updated', function(err, value) {
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

describe('Expand keys with invalid common properties path ', function() {

  // The current copy of the git master branch.  This is initialized before each test in the suite.
  var branch;
  beforeEach(function(done) {

    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.  These are all tests of expand_keys mode, so set that here.
    git_utils.initRepo(_.extend(git_utils.createRepoConfig(), {'expand_keys': true, 'common_properties': "wrong/path/common.properties"}), function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  it('should store as flat file if invalid path in config', function(done) {
    var common_key = 'common.properties';
    var common_value = 'bar=bar';
    var sample_key = 'simple.properties';
    var sample_value = 'foo=${bar}';

    git_utils.addFileToGitRepo(common_key, common_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {

        git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
          if (err) return done(err);

          branch.handleRefChange(0, function(err) {
            if (err) return done(err);

            consul_utils.validateValue('test_repo/master/simple.properties', sample_value, function(err, value) {
              if (err) return done(err);
              done();
            });
          });
        });
      });
    });
  });

});

describe('Expand keys using delta', function() {
  var branch;
  beforeEach(function(done) {
    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.  These are all tests of expand_keys mode, so set that here.
    git_utils.initRepo(_.extend(git_utils.createRepoConfig(), {'expand_keys': true, 'expand_keys_diff': true}), function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  /*JSON*/
  it ('should handle additions of new JSON files', function(done) {
    var sample_key = 'simple.json';
    var sample_value = '{ "first_level" : { "second_level": "is_all_we_need" } }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/simple.json/first_level/second_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);
          done();
        });
      });
    });
  });

  it ('should handle update of JSON file', function(done) {
    var sample_key = 'changeme.json';
    var sample_value = '{ "first_level" : "is_all_we_need" }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/changeme.json/first_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);

          // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
          git_utils.addFileToGitRepo(sample_key, '{ "first_level" : "is super different" }', "Change a file.", function(err) {
            if (err) return done(err);

            branch.handleRefChange(0, function(err) {
              if (err) return done(err);

              // At this point, the repo should have populated consul with our sample_key
              consul_utils.validateValue('test_repo/master/changeme.json/first_level', 'is super different', function(err, value) {
                if (err) return done(err);

                done();
              });
            });
          });
        });
      });
    });
  });

  it ('should handle new key in JSON file', function(done) {
    var sample_key = 'changeme.json';
    var sample_value = '{ "first_level" : "is_all_we_need" }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);
        // At this point, the repo should have populated consul with our sample_key
        consul_utils.validateValue('test_repo/master/changeme.json/first_level', 'is_all_we_need', function(err, value) {
          if (err) return done(err);
          
          // Get the ModifyIndex of the 'first_level' key so we can make sure it isn't changed when the next key is
          // added. This implies the delta is working.
          consul_utils.getKeyIndices('test_repo/master/changeme.json/first_level', function(err, createIndex, modifyIndex) {
            if (err) return done(err);

            // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
            git_utils.addFileToGitRepo(sample_key, '{ "first_level" : "is_all_we_need", "first_level_new" : "is a new key" }', "Change a file.", function(err) {
              if (err) return done(err);

              branch.handleRefChange(0, function(err) {
                if (err) return done(err);

                // At this point, the repo should have populated consul with our sample_key
                consul_utils.validateValue('test_repo/master/changeme.json/first_level_new', 'is a new key', function(err, value) {
                  if (err) return done(err);

                  // We also want to validate the the 'first_level' key has NOT been updated
                  consul_utils.validateModifyIndex('test_repo/master/changeme.json/first_level', modifyIndex, function(err) {
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

  it ('should handle delete in JSON file', function(done) {
    var sample_key = 'deleteme.json';
    var sample_value = '{ "a" : "1", "b" : "2", "c" : "3" }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);

        // Validate that at least one of the keys made it to consul
        consul_utils.validateValue('test_repo/master/deleteme.json/a', '1', function(err, value) {
          if (err) return done(err);

          // Track the ModifyIndex of a key that is NOT supposed to change
          consul_utils.getKeyIndices('test_repo/master/deleteme.json/a', function(err, createIndex, modifyIndex) {
            if (err) return done(err);

            // Update the document such that the 'b' key is removed.
            git_utils.addFileToGitRepo(sample_key, '{ "a" : "1", "c" : "3" }', "Change a file.", function(err) {
              if (err) return done(err);

              branch.handleRefChange(0, function(err) {
                if (err) return done(err);

                // Check that the 'b' key is gone
                consul_utils.validateValue('test_repo/master/deleteme.json/b', undefined, function(err, value) {
                  if (err) return done(err);

                  // Ensure that the a key was not modified
                  consul_utils.validateModifyIndex('test_repo/master/deleteme.json/a', modifyIndex, function(err) {
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

  it ('should handle complex diff in JSON file', function(done) {
    var sample_key = 'complexdiff.json';
    var sample_value = '{ "a" : "1", "b" : "2", "c" : { "d" : "4", "e" : { "f" : "6", "g" : "7" } } }';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);

        // Validate that at least one of the keys made it to consul
        consul_utils.validateValue('test_repo/master/complexdiff.json/a', '1', function(err, value) {
          if (err) return done(err);

          // Track the ModifyIndex of a key that is NOT supposed to change
          consul_utils.getKeyIndices('test_repo/master/complexdiff.json/a', function(err, createIndex, modifyIndex) {
            if (err) return done(err);

            sample_value = '{ "a" : "1", "b" : { "i" : "9", "j" : { "k" : "11" } }, "c" : { "d" : "104", "e" : { "f" : "6", "h" : "8" } } }';
            // Update the document such that the 'b' key is removed.
            git_utils.addFileToGitRepo(sample_key, sample_value, "Change a file.", function(err) {
              if (err) return done(err);

              branch.handleRefChange(0, function(err) {
                if (err) return done(err);

                // Check that the 'i' key is set 
                consul_utils.validateValue('test_repo/master/complexdiff.json/b/i', '9', function(err, value) {
                  if (err) return done(err);

                  // Ensure that the a key was not modified
                  consul_utils.validateModifyIndex('test_repo/master/complexdiff.json/a', modifyIndex, function(err) {
                    if (err) return done(err);

                    consul_utils.validateValue('test_repo/master/complexdiff.json/c/d', '104', function(err, value) {
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
});

describe('Expand keys using delta ignoring file extensions', function() {
  var branch;
  beforeEach(function(done) {
    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.  These are all tests of expand_keys mode, so set that here.
    git_utils.initRepo(_.extend(git_utils.createRepoConfig(), {'expand_keys': true, 'expand_keys_diff': true, 'ignore_file_extension': true}), function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  it ('should handle keys with same prefix', function(done) {
    var sample_key = 'foo-test.json';
    var sample_value = 'bar';

    // Add the file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
    git_utils.addFileToGitRepo(sample_key, sample_value, "Add a file.", function(err) {
      if (err) return done(err);

      branch.handleRefChange(0, function(err) {
        if (err) return done(err);

        // Validate that at least one of the keys made it to consul
        consul_utils.validateValue('test_repo/master/foo-test', 'bar', function(err, value) {
          if (err) return done(err);

          var conflicting_key = 'foo.json';
          var conflicting_value = '{ "bar": "baz" }';

          // Update the document to add a key that starts with the same prefix
          git_utils.addFileToGitRepo(conflicting_key, conflicting_value, "Change a file.", function(err) {
              if (err) return done(err);

              branch.handleRefChange(0, function(err) {
                if (err) return done(err);

                // Check that the new value is set
                consul_utils.validateValue('test_repo/master/foo/bar', 'baz', function(err, value) {
                  if (err) return done(err);

                  // Ensure that the original value wasn't changed
                  consul_utils.validateValue('test_repo/master/foo-test', 'bar', function(err, value) {
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
