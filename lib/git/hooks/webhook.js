var util = require('util');

var express = require('express');
var bodyParser = require('body-parser');

var logger = require('../../logging.js');
var Branch = require('../branch.js');
var git_commands = require('../commands.js');

// Create an object to map from host port to app.  Multiple hosts can be configured to listen
// on the same port.
var server_apps = {};

/**
 * Create a listener for calls from the Webhook, whether stash or github.
 */
function init_express(config) {

  // Validate config.  Fail if the provided config matches an existing host / port combination.
  /* istanbul ignore next */
  if (!config) {
    throw 'Invalid config provided to webhook';
  }
  if (!config.port || isNaN(config.port)) {
    throw 'Invalid webhook port ' + config.port;
  }
  if (!config.url) {
    throw 'No config url provided';
  }

  // Each webhook port maps to a server_app object, a container we create to store both the express
  // app and the set of routes registered in that app.  We use the latter data to make sure more than
  // one webhook does not try to register the same route on the same port.
  var server_app = server_apps[config.port];
  if (!server_app) {
    server_app = {};

    var app = express();
    server_app.app = app;

    // Stash's webhook sends a totally bogus content-encoding.  Smack it before the body parser runs.
    app.use(function() {
      return function(req, res, next) {
        if (req.headers['content-encoding'] == 'UTF-8') {
          delete req.headers['content-encoding'];
        }
        next();
      }
    }());

    // Parse application/json
    app.use(bodyParser.json());

    // Parse form data (for bitbucket)
    app.use(bodyParser.urlencoded({extended:true}));

    app.listen(config.port);

    server_app.urls = {};
    server_apps[config.port] = server_app;
  } else {
    // Two webhooks can't have the same url and port, so fail if this is the case.
    if (server_app.urls[config.url]) {
      throw "A webhook is already listening on " + config.port + ", " + config.url;
    }
  }

  // In all cases where we made it here, we want to track the config.url to make sure that no duplicate
  // webhook routes can be created.
  server_app.urls[config.url] = true;

  return server_app.app;
}

// Create a webhook function for all common operations.  It will use the provided config to initialize
// an express app (if one has not been initialized yet), and it will call into the enclosed implementation
// object to perform Git or Stash-specific functions.
function create_webhook(config, repo, implementation) {
  var app = init_express(config);

  // We don't care what method is used, so use them all.
  ['get','post','put','delete'].forEach(function(verb) {
    app[verb](config.url, function(req, res){
      logger.trace('Got pinged by %s hook, checking request', implementation.type);

      /* istanbul ignore else */
      if (implementation.isValid(req)) {

        logger.trace(util.inspect(req.body, {depth: 10}));

        // Only pull changed branches
        var changes = implementation.getHeadChanges(req);
        if (changes.length === 0) {
          logger.trace('No changes in a relevant branch. Checking and updating tags');
          if (repo.repo_config.support_tags === true) {
            repo.createNewTagsAsBranch(function(err, new_tags) {
              if (err) return logger.error(err);
            });
          }
          return res.send('ok');
        }

        for (var i=0; i<changes.length; ++i) {
          var change = changes[i];
          var to_hash = change.to_hash;
          logger.info('Webhook noted change to branch %s of repo %s with commit id %s', change.branch, repo.name, change.to_hash);

          // Update consul git branch
          var branch = repo.branches[change.branch];
          if (branch) {
            branch.handleRefChange(change.to_hash, function(err) {
              /* istanbul ignore next */
              if (err) logger.error(err);

              logger.debug('Updates in branch %s of repo %s complete', change.branch, repo.name);
            });
          }
        }
      }

      res.send('ok');
    });
  });

  logger.info('%s listener initialized at http://localhost:%s%s', implementation.type, config.port, config.url);
};

/**
 * This object defines the properties unique to a github webhook.
 */
exports.github = {

  type: 'github',

  isValid: function(req) {
    return req && req.body && req.body.ref && req.body.head_commit && req.body.head_commit.id;
  },

  getHeadChanges: function(req) {
    // Return a change to head, if any.
    if (req.body.ref.indexOf('refs/heads/') === 0) {
      return [{
        'to_hash': req.body.head_commit.id,
        'branch': req.body.ref.substring(11)
      }];
    }

    // Otherwise, return an empty array.
    return [];
  }
};

/**
 * This object defines the properties unique to a stash webhook.
 */
exports.stash = {

  type: 'stash',

  isValid: function(req) {
    return req && req.body && req.body.refChanges;
  },

  getHeadChanges: function(req) {
    var changes = [];
    for (var i=0; i<req.body.refChanges.length; ++i) {
      var refChange = req.body.refChanges[i];

      // Only update if the head of a branch changed
      /* istanbul ignore else */
      if (refChange.refId && (refChange.refId.indexOf('refs/heads/') === 0) && refChange.toHash) {
        changes.push({
          'to_hash': refChange.toHash,
          'branch': refChange.refId.substring(11)
        });
      }
    }
    return changes;
  }
};

/**
 * This object defines the properties unique to a bitbucket webhook.
 */
exports.bitbucket = {

  type: 'bitbucket',

  isValid: function(req) {

    if (req && req.body && req.body.payload) {
      try {
        req.body = JSON.parse(req.body.payload);
        return req.body && req.body.commits && req.body.commits.length;
      /* istanbul ignore next */
      } catch(e) {
        // We don't care about a busted message.
      }
    }

    return false;
  },

  getHeadChanges: function(req) {
    var changes = [];
    for (var i=0; i<req.body.commits.length; ++i) {
      var commit = req.body.commits[i];

      // Only update if the head of a branch changed
      /* istanbul ignore else */
      if (commit.branch && (commit.parents.length !== 0) && commit.node) {
        changes.push({
          'to_hash': commit.node,
          'branch': commit.branch
        });
      }
    }
    return changes;
  }
};

/**
 * This object defines the properties unique to a gitlab webhook.
 */
exports.gitlab = {

  type: 'gitlab',

  isValid: function(req) {
    return req && req.body && req.body.ref && req.body.after;
  },

  getHeadChanges: function(req) {
    // Return a change to head, if any.
    if (req.body.ref.indexOf('refs/heads/') === 0) {
      return [{
        'to_hash': req.body.after,
        'branch': req.body.ref.substring(11)
      }];
    }

    // Otherwise, return an empty array.
    return [];
  }
};

/**
 * Register an init method for each support webhook implementation.
 */
[exports.bitbucket, exports.github, exports.stash, exports.gitlab].forEach(function(hook_impl) {
  hook_impl.init = function(repo, config) {
    create_webhook(repo, config, hook_impl);
  };
});
