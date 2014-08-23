var util = require('util');

var logger = require('winston');

var express = require('express');
var bodyParser = require('body-parser');

/**
 * Create a listener for calls from the stash Post-Receive Webhook
 * (https://confluence.atlassian.com/display/STASH/POST+service+webhook+for+Stash)
 */
exports.init = function(config, git_manager) {
  
  // TODO: Validate config

  var app = express();

  // Stash's webhook sends a totally bogus content-encoding.  Smack it before the body parser runs.
  app.use(function() {return function(req, res, next) {delete req.headers['content-encoding'];next();}}());

  // Parse application/json
  app.use(bodyParser.json());

  // We don't care what method is used, so use them all.
  ['get','post','put','delete'].forEach(function(verb) {
    app[verb](config.url || '/gitpoke', function(req, res){
      //console.log(util.inspect(req.body));
      logger.info('Got pinged by stash hook, checking results');

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
            if (!bm) return logger.verbose('No branch_manager for branch %s, ignoring.', branch_name);
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

  app.listen(config.port || 5050);
  
  logger.info('Stash listener initialized at http://localhost:%s%s', config.port, config.url);
};