var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var util = require('util');

var logger = require('../logging.js');

var git = require('./');

var Branch = require('./branch.js');

var hook_providers = {
  'bitbucket' : require('./hooks/webhook.js').bitbucket,
  'github' : require('./hooks/webhook.js').github,
  'stash' : require('./hooks/webhook.js').stash,
  'polling' : require('./hooks/polling.js')
};

function Repo(repo_config) {
  var this_obj = this;

  // TODO: Throw if local_store isn't set.
  // TODO: Throw if local_store doesn't exist on the fs.

  if (!repo_config) throw new Error('No configuration provided for repo');
  if (!repo_config.url || !repo_config.name || !repo_config.branches) {
    throw new Error("A repo must have a url, a name, and a branch array.");
  }

  if (!repo_config.branches || repo_config.branches.length === 0) {
    throw new Error('No branches specified.');
  }

  var unique_branches = _.uniq(repo_config.branches);
  if (unique_branches.length !== repo_config.branches.length) {
    throw new Error("Duplicate name found in branches for repo " + repo_config.name + ": " + repo_config.branches);
  }

  var branches = {};
  Object.defineProperty(this, 'name', {value: repo_config.name});
  Object.defineProperty(this, 'url', {value: repo_config.url});
  Object.defineProperty(this, 'branch_names', {value: repo_config.branches});
  Object.defineProperty(this, 'branches', {value: branches});
  Object.defineProperty(this, 'hooks', {value: repo_config.hooks});

  repo_config.branches.forEach(function(branch) {
    // TODO: Switch to passing in the repo, not the repo_config.
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

      // Validate that we are tracking each Branch before enabling hooks to avoid any
      // race conditions where a hook fires before a Branch is initialized.
      if (branch_count === this_obj.branch_names.length) {
        logger.debug('Branches initialized');

        if (git.daemon && this_obj.hooks) {

          // Flag that hooks are running.  This data can be used by unit tests to validate
          // that daemon config is working properly.
          Object.defineProperty(this_obj, 'hooks_active', {value: true});

          // Init hooks
          var errs = [];

          this_obj.hooks.forEach(function(hook) {
            try {
              var hook_provider = hook_providers[hook.type];
              if (!hook_provider) {
                return errs.push("Invalid hook type " + hook.type);
              }

              hook_provider.init(hook, this_obj);
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
