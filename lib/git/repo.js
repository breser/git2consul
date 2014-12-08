var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var util = require('util');

var logger = require('../logging.js');

var Branch = require('./branch.js');

var hook_providers = {
  'bitbucket' : require('./hooks/webhook.js').bitbucket,
  'github' : require('./hooks/webhook.js').github,
  'stash' : require('./hooks/webhook.js').stash,
  'polling' : require('./hooks/polling.js')
};

function Repo(repo_config) {
  var this_obj = this;

  var branches = {};
  Object.defineProperty(this, 'name', {value: repo_config.name});
  Object.defineProperty(this, 'branch_names', {value: repo_config.branches});
  Object.defineProperty(this, 'branches', {value: branches});
  Object.defineProperty(this, 'hooks', {value: repo_config.hooks});

  if (!repo_config.branches || repo_config.branches.length === 0) throw new Error('No branches specified.');

  var unique_branches = _.uniq(repo_config.branches);
  if (unique_branches.length !== repo_config.branches.length) 
    throw new Error("Duplicate name found in branches for repo " + repo_config.name + ": " + repo_config.branches);

  repo_config.branches.forEach(function(branch) {
    branches[branch] = new Branch(repo_config, branch);
  });
}

Repo.prototype.getBranch = function(branch_name) {
  return this.branches[branch_name];
};

Repo.prototype.init = function(cb) {
  var this_obj = this;
  var branch_count = 0;

  logger.info("Initting repo %s", this.name);

  for (var branch_name in this.branches) {
    var branch = this.branches[branch_name];

    branch.init(function(err) {
      if (err) return cb(err);

      ++branch_count;

      if (branch_count === this_obj.branch_names.length) {
        // We are tracking each Branch.
        logger.debug('Branches initialized');

        // TODO: Re-add daemon check
        if (/**daemon &&**/ this_obj.hooks) {
          // Init hooks
          var errs = [];

          this_obj.hooks.forEach(function(hook) {
            try {
              var hook_provider = hook_providers[hook.type];
              if (!hook_provider) {
                return errs.push("Invalid hook type " + hook.type);
              }

              hook_provider.init(hook, this_obj, process.env.MOCK);
            } catch (e) {
              return errs.push("Hook configuration failed due to " + e);
            }
          });

          if (errs.length > 0) return cb(errs);
        }

        cb(null);
      }
    });
  }

};

module.exports = Repo;
