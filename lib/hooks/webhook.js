var util = require('util');

var express = require('express');
var bodyParser = require('body-parser');

var logger = require('../utils/logging.js');

// Create an object to map from host port to app.  Multiple hosts can be configured to listen
// on the same port.
var server_apps = {};

/**
 * Create a listener for calls from the Webhook, whether stash or github.
 */
function init_express(config) {

  // Validate config.  Fail if the provided config matches an existing host / port combination.
  /* istanbul ignore next */
  if (!config) throw 'Invalid config provided to webhook';
  if (!config.port || isNaN(config.port)) throw 'Invalid webhook port ' + config.port;
  if (!config.url) throw 'No config url provided';

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
        if (req.headers['user-agent'] == 'Bitbucket.org') {

        }
        next();
      }
    }());

    // Parse application/json

    app.use(bodyParser.json());
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
function create_webhook(config, git_manager, implementation) {
  var app = init_express(config);

  // We don't care what method is used, so use them all.
  ['get','post','put','delete'].forEach(function(verb) {
    app[verb](config.url, function(req, res){
      logger.debug('Got pinged by %s hook, checking request', implementation.type);

      /* istanbul ignore else */
      if (implementation.isValid(req)) {

        logger.trace  (util.inspect(req.body, {depth: 10}))

        // Only pull changed branches
        var changes = implementation.getHeadChanges(req);
        for (var i=0; i<changes.length; ++i) {
          var change = changes[i];
          var ref = change.ref;
          var to_hash = change.to_hash;
          logger.debug('Handling reference change to %s', util.inspect(ref));

          // Update consul git branch
          var bm = git_manager.getBranchManager(change.branch);
          if (!bm) {
            logger.trace('No branch_manager for branch %s, ignoring.', change.branch);
            return res.send('ok');
          }
          bm.handleRefChange(change.to_hash, function(err) {
            /* istanbul ignore next */
            if (err) {
              logger.error(err);
              return res.send('ok');
            }

            logger.debug('Updates in branch %s complete', change.branch);
          });
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
        'ref': req.body.ref,
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
          'ref': refChange.refId,
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
          'ref': commit.parents[0],
          'to_hash': commit.node,
          'branch': commit.branch
        });
      }
    }
    return changes;
  }
};

/**
 * Register an init method for each support webhook implementation.
 */
[exports.bitbucket, exports.github, exports.stash].forEach(function(hook_impl) {
  hook_impl.init = function(git_manager, config) {
    create_webhook(git_manager, config, hook_impl);
  };
});
