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

  if (!repo_config) throw new Error('No configuration provided for repo');

  if (!repo_config.local_store || !repo_config.url || !repo_config.name || !repo_config.branches) {
    throw new Error("A repo must have a local_store, a url, a name, and a branch array.");
  }

  // Check to make sure local_store is valid and writeable.
  try {
    var stat = fs.statSync(repo_config.local_store);
  } catch(e) {
    throw new Error('local store ' + repo_config.local_store + ' does not exist');
  }

  var can_write = ((process.getuid() === stat.uid) && (stat.mode & 00200)) || // User is owner and owner can write.
                  ((process.getgid() === stat.gid) && (stat.mode & 00020)) || // User is in group and group can write.
                  ((stat.mode & 00002)); // Anyone can write.
  if (!can_write) throw new Error('local store ' + repo_config.local_store + ' for repo ' + repo_config.name + ' is not a writeable directory');

  if (repo_config.branches.length === 0) {
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

  var pending_operations = 0;

  var errs = [];

  var wrapped_cb = function(err) {
    if (err) errs.push(err);

    --pending_operations;
    if (pending_operations === 0) return cb(errs.length > 0 ? errs : undefined);
  };

  for (var branch_name in this.branches) {
    ++pending_operations;
    var branch = this.branches[branch_name];

    branch.init(function(err) {
      if (err) return wrapped_cb(err);

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
          this_obj.hooks.forEach(function(hook) {
            ++pending_operations;
            try {
              var hook_provider = hook_providers[hook.type];
              if (!hook_provider) {
                return wrapped_cb("Invalid hook type " + hook.type);
              }

              hook_provider.init(hook, this_obj);
              wrapped_cb();
            } catch (e) {
              return wrapped_cb("Hook configuration failed due to " + e);
            }
          });

        }
      }

      wrapped_cb();
    });
  }

};

module.exports = Repo;
