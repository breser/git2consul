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
  if (!config) throw 'Invalid config provided to webhook';
  if (!config.port || isNaN(config.port)) throw 'Invalid webhook port ' + config.port;
  if (!config.url) throw 'No config url provided';

  var app = server_apps[config.port];
  if (!app) {
    app = express();
    server_apps[config.port] = app;
  }

  return app;
}

exports.github = {
  init: function(config, git_manager) {
    var app = init_express(config);

    // Parse application/json
    app.use(bodyParser.json());
    app.listen(config.port);

    // We don't care what method is used, so use them all.
    ['get','post','put','delete'].forEach(function(verb) {
      app[verb](config.url || '/gitpoke', function(req, res){
        logger.info('Got pinged by github hook, checking results');

        if (req.body && req.body.ref && req.body.head_commit && req.body.head_commit.id) {
          // Only pull changed branches
          var ref = req.body.ref;
          var to_hash = req.body.head_commit.id;
          logger.debug('Handling reference change to %s', util.inspect(ref));

          // Only update if the head of a branch changed
          if (ref.indexOf('refs/heads/') === 0) {
            // Strip leading 'refs/heads/' from branch name
            var branch_name = ref.substring(11);

            // Update consul git branch
            var bm = git_manager.getBranchManager(branch_name);
            if (!bm) return logger.trace('No branch_manager for branch %s, ignoring.', branch_name);
            bm.handleRefChange(to_hash, function(err) {
              if (err) return logger.error(err);
        
              logger.debug('Updates in branch %s complete', branch_name);
            });
          }
        }

        res.send('ok');
      });
    });
    
    logger.info('Github listener initialized at http://localhost:%s%s', config.port, config.url);
  }
};

exports.stash = {
  init: function(config, git_manager) {
    var app = init_express(config);

    // Stash's webhook sends a totally bogus content-encoding.  Smack it before the body parser runs.
    app.use(function() {return function(req, res, next) {delete req.headers['content-encoding'];next();}}());

    // Parse application/json
    app.use(bodyParser.json());
    
    app.listen(config.port);

    // We don't care what method is used, so use them all.
    ['get','post','put','delete'].forEach(function(verb) {
      app[verb](config.url, function(req, res){
        //console.log(util.inspect(req.body));
        logger.info('Got pinged by stash hook, checking results');

        logger.info(util.inspect(req.body))

        if (req.body && req.body.refChanges) {
          // Only pull changed branches
          req.body.refChanges.forEach(function(refChange) {

            logger.debug('Handling reference change %s', util.inspect(refChange));

            // Only update if the head of a branch changed
            if (refChange.refId && (refChange.refId.indexOf('refs/heads/') === 0) && refChange.toHash) {
              // Strip leading 'refs/heads/' from branch name
              var branch_name = refChange.refId.substring(11);

              // Update consul git branch
              var bm = git_manager.getBranchManager(branch_name);
              if (!bm) return logger.trace('No branch_manager for branch %s, ignoring.', branch_name);
              bm.handleRefChange(refChange.toHash, function(err) {
                if (err) return logger.error(err);

                logger.debug('Updates in branch %s complete', branch_name);
              });
            }
          });
        }

        res.send('ok');
      });
    });
    
    logger.info('Stash listener initialized at http://localhost:%s%s', config.port, config.url);
  }
};
