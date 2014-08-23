var util = require('util');

var express = require('express');
var bodyParser = require('body-parser');

var logger = require('winston');

/**
 * Create a listener for calls from the github Push Webhook
 */
exports.init = function(config, git_manager) {
  
  // TODO: Validate config

  var app = express();

  // Parse application/json
  app.use(bodyParser.json());

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
          if (!bm) return logger.verbose('No branch_manager for branch %s, ignoring.', branch_name);
          bm.handleRefChange(to_hash, function(err) {
            if (err) return logger.error(err);
      
            logger.debug('Updates in branch %s complete', branch_name);
          });
        }
      }

      res.send('ok');
    });
  });

  app.listen(config.port || 5151);
  
  logger.info('Github listener initialized at http://localhost:%s%s', config.port, config.url);
};