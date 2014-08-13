var fs = require('fs');
var util = require('util');

var express = require('express');
var bodyParser = require('body-parser');

var ConsulClass = require('consul-node');

var consul = new ConsulClass();

require('./utils/read_config.js')(function(err, config) {
  
  if (err) return console.error(err);

  var GitManagerClass = require('./lib/git_manager.js');
  
  console.log(config);
  
  var git_manager = new GitManagerClass(config.local_store, config.git_url, config.branches);

  /**
   * Process a file node.  If it's a directory, process each file in the directory.
   * If it's a file, add the file as a KV to Consul with filename as key and file content
   * as value.
   */
  var process_file = function(data_dir, branch, f) {
  
    if (!f) f = '';
  
    var fqf = data_dir + f;
  
    // Don't recurse into .git directories.
    if (f.indexOf('.git') != -1) return;
  
    if (fs.statSync(fqf).isDirectory()) {
    
      console.log('Reading directory %s', fqf);
    
      fs.readdir(fqf, function(err, files) {
        if (err) return console.error('Failed to read directory %s', err);
      
        files.forEach(function(file) {
          process_file(data_dir, branch, f + '/' + file);
        });
      });
    
    } else {
    
      fs.readFile(fqf, {encoding:'utf8'}, function(err, body) {
      
        // Prepend branch name to the KV so that the subtree is properly namespaced in Consul
        var key_name = branch + '/' + f.substring(1);
        var body = body ? body.trim() : '';
      
        if (err) return console.error('Failed to read directory %s', err);
        console.log('Adding key %s, value %s', key_name, body);
        consul.kv.put(key_name, body, function(err) {
          if (err) return console.error('Failed to put key %s: %s', key_name, require('util').inspect(err));
        
          console.log('Wrote key %s', key_name);
        });
      });
    
    }
  };
  
  git_manager.init(function(err) {
    
    if (err) return console.error("Failed to load git_manager:\n%s", err);

    var app = express();

    // Stash's webhook sends a totally bogus content-encoding.  Smack it before the body parser runs.
    app.use(function() {return function(req, res, next) {delete req.headers['content-encoding'];next();}}());

    // parse application/json
    app.use(bodyParser.json());
  
    var handle_ref_change = function(refChange) {
    
      console.log('Handling reference change %s', util.inspect(refChange));
    
      // Only update if the head of a branch changed
      if (refChange.refId && (refChange.refId.indexOf('refs/heads/') === 0) && refChange.toHash) {
        // Strip leading 'refs/heads/' from branch name
        var branch_name = refChange.refId.substring(11);

        // Update consul git branch
        var bm = git_manager.getBranchManager(branch_name);
        bm.currentRef(function(err, ref) {
          if (err) return console.error('Failed to check current state of branch %s: %s', branch_name, err);
        
          if (ref === refChange.toHash) {
            return console.log('Branch %s already at most recent version', branch_name);
          }
      
          bm.pull(function(err) {
            if (err) return console.error('Failed to update %s due to %s', branch_name, err);

            bm.currentRef(function(err, ref) {
              if (err) return console.error('Failed to check current state of branch %s', branch_name);
        
              if (ref !== refChange.toHash) {
                // TODO: Remove this once testing is complete.
                //return console.error('Branch update failed to reach toHash value %s', refChange.toHash);
              }
            
              console.log('Branch %s updated.  Syncing with Consul', branch_name);

              // Add changed branch to Consul
              process_file(bm.getPath(), branch_name);
            });
          });
        });
      }
    };
  
    // TESTING PURPOSES
    //handle_ref_change({'refId':'refs/heads/development', 'toHash':'0'});
    // TESTING PURPOSES

    ['get','post','put','delete'].forEach(function(verb) {
      app[verb]('/gitpoke', function(req, res){
        //console.log(util.inspect(req.body));
        console.log('Got pinged by git hook, checking results');
    
        if (req.body && req.body.refChanges) {
          // Only pull changed branches
          req.body.refChanges.forEach(handle_ref_change);
        }
    
        res.send('ok');
      });
    });

    app.listen(5050);
  });
  
});
