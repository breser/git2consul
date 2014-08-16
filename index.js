var util = require('util');

var express = require('express');
var bodyParser = require('body-parser');

var config_reader = require('./utils/config_reader.js');
var git_manager_source = require('./lib/git_manager.js');

config_reader.read(function(err, config) {
  
  if (err) return console.error(err);
  
  console.log(config);
  
  git_manager_source.createGitManager(config.local_store, config.git_url, config.branches, function(err, git_manager) {
    
    if (err) return console.error(err);

    var app = express();

    // Stash's webhook sends a totally bogus content-encoding.  Smack it before the body parser runs.
    app.use(function() {return function(req, res, next) {delete req.headers['content-encoding'];next();}}());

    // parse application/json
    app.use(bodyParser.json());

    ['get','post','put','delete'].forEach(function(verb) {
      app[verb]('/gitpoke', function(req, res){
        //console.log(util.inspect(req.body));
        console.log('Got pinged by git hook, checking results');
    
        if (req.body && req.body.refChanges) {
          // Only pull changed branches
          req.body.refChanges.forEach(function(refChange) {
            git_manager.handleRefChange(refChange);
          });
        }
    
        res.send('ok');
      });
    });

    app.listen(5050);
  });
  
});
