var _ = require('underscore');
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
        next();
      }
    }());

    // Parse application/json
    app.use(bodyParser.json());

    app.listen(config.port);

    server_app.url = config.url;
    server_apps[config.port] = server_app;
  } else {
    // Two webhooks can't have the same url and port, so fail if this is the case.
    if (server_app.url === config.url) {
      throw "A webhook is already listening on " + config.port + ", " + config.url;
    }
  }

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

      logger.debug(util.inspect(req.body))

      /* istanbul ignore else */
      if (implementation.isValid(req)) {
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
  },

  init: function(config, git_manager) {
    create_webhook(config, git_manager, this);
  }
};

/**
 * This object defines the properties unique to a stash webhook.
 */
exports.stash = {

  type: 'github',

  isValid: function(req) {
    return req && req.body && req.body.refChanges;
  },

  getHeadChanges: function(req) {
    var changes = [];
    for (var i=0; i<req.body.refChanges.length; ++i) {
      var refChange = req.body.refChanges[i];

      logger.debug('Handling reference change %s', util.inspect(refChange));

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
  },

  init: function(config, git_manager) {
    create_webhook(config, git_manager, this);
  }
};
