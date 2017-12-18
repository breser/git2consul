var should = require('should');
var _ = require('underscore');
var fs = require('fs');

var mkdirp = require('mkdirp');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var git_utils = require('./utils/git_utils.js');
var consul_utils = require('./utils/consul_utils.js');

describe('Parse YAML', function() {

  // The current copy of the git master branch.  This is initialized before each test in the suite.
  var branch;
  beforeEach(function(done) {

    // Each of these tests needs a working repo instance, so create it here and expose it to the suite
    // namespace.  These are all tests of expand_keys mode, so set that here.
    var repoConfig = git_utils.createRepoConfig();
    // Add array settings
    repoConfig.array_format = 'json';
    repoConfig.array_key_format = '_/#';
    git_utils.initRepo(_.extend(repoConfig, {'expand_keys': true}), function(err, repo) {
      if (err) return done(err);

      // The default repo created by initRepo has a single branch, master.
      branch = repo.branches['master'];

      done();
    });
  });

  /*YAML*/

  it('should handle complex YAML files', function(done) {
    var sample_key = 'complex_sample.yaml';
    // from: js-yaml / test / samples-load-errors / forbidden-value.yml
    var sample_file = "./test/resources/complex_sample.yaml";

    fs.readFile(sample_file, "utf-8", function(err, new_file_content){
      if (err) return done(err);

      // Add the sample file, call branch.handleRef to sync the commit, then validate that consul contains the correct info.
      git_utils.addFileToGitRepo(sample_key, new_file_content, "Add a file.", function(err) {
        if (err) return done(err);
        branch.handleRefChange(0, function(err) {
          if (err) return done(err);

          var values_to_test = [
              {
                key:'name',
                value:'Kostas D\'vloper'
              },{
                key:'job',
                value:'Developer'
              },{
                key:'skill',
                value:'Elite'
              },{ 
                key:'employed',
                value:'true'
              },{
                key:'foods',
                value:'["Apple","Orange","Strawberry","Mango"]'
              },{
                key:'languages/perl/certified',
                value:'true'
              },{
                key:'languages/perl/level/scored',
                value:'["high","medium"]'
              },{
                key:'languages/perl/level/scored/0',
                value:'high'
              }
          ];
          values_to_test.forEach(function(test_value){
            consul_utils.validateValue("test_repo/master/complex_sample.yaml/"+test_value['key'], test_value['value'], function(err, value) {
              if (err) return done(err);
            });
          });
          consul_utils.validateValue('test_repo/master/complex_sample.yaml/my.server.path/0/KEY-ENV-VAR', 'true', function(err, value) {
            if (err) return done(err);
            done();
          });
        });
      });
    });
  });
});
