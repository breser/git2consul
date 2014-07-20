var fs = require('fs');

var Consul = require('consul-node');

var consul = new Consul({
  host: 'localhost',
  port: 8500,
});

if (process.argv.length < 3) {
  console.error('usage: node . [p,d,s] ...')
  process.exit(1);
}

var DELETE_TYPE = 'delete';
var PUT_TYPE = 'put';
var SERVER_TYPE = 'server';

if (process.argv[2] === 'p') operation = PUT_TYPE;
else if (process.argv[2] === 'd') operation = DELETE_TYPE;
else if (process.argv[2] === 's') operation = SERVER_TYPE;

if (operation === PUT_TYPE) {
  
  var process_file = function(f) {
    
    if (!f) f = '';
    
    var fqf = data_dir + f;
    
    if (fs.statSync(fqf).isDirectory()) {
      
      console.log('Reading directory %s', fqf);
      
      fs.readdir(fqf, function(err, files) {
        if (err) return console.error('Failed to read directory %s', err);
        
        files.forEach(function(file) {
          process_file(f + '/' + file);
        });
      });
      
    } else {
      
      fs.readFile(fqf, {encoding:'utf8'}, function(err, body) {
        
        var key_name = f.substring(1);
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
  
  if (process.argv.length != 4) {
    console.error('usage: node . d data_dir');
    process.exit(2);
  }
  
  var data_dir = process.argv[3];
  process_file();
}

if (operation === DELETE_TYPE) {

  var kill_entry = function(key) {
    console.log('Deleting %s', key);
    consul.kv.delete(key, function(err) {
      if (err) return console.error(err);
    });
  };
  
  console.log('Deleting all keys');
  consul.kv.get('?recurse', function (err, items) {
    if (err) return console.error(err);
    
    if (items) {
      items.forEach(function(item) {
        kill_entry(item.key);
      });
    }
  });

}

if (operation === SERVER_TYPE) {
  var express = require('express');
  var bodyParser = require('body-parser');
  
  var util = require('util');

  var GIT_ROOT = '/tmp/configuration';
  var GIT_URL = 'ssh://git@devgit.vistaprint.net:7999/~rbreen/configuration.git';
  var BRANCHES = ['development', 'staging', 'production'];
  
  var git_manager = require('./lib/git_manager.js')(GIT_ROOT, GIT_URL, BRANCHES, function(err) {
    
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
          if (err) return console.error('Failed to check current state of branch %s', branch_name);
          
          if (ref === refChange.toHash) {
            return console.log('Branch %s already at most recent version', branch_name);
          }
        
          bm.pull(function(err) {
            if (err) return console.error('Failed to update %s due to %s', branch_name, err);

            bm.currentRef(function(err, ref) {
              if (err) return console.error('Failed to check current state of branch %s', branch_name);
          
              if (ref !== refChange.toHash) {
                return console.error('Branch update failed to reach toHash value %s', refChange.toHash);
              }
              
              console.log('Branch %s updated.  Syncing with Consul', branch_name);

              // TODO: Add changed branch to Consul
            });
          });
        });
      }
    };
    
    // TESTING PURPOSES
    handle_ref_change({'refId':'refs/heads/development', 'toHash':'0'});
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
}
