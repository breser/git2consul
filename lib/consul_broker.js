var fs = require('fs');
var path = require('path');

var ConsulClass = require('consul-node');
var consul = new ConsulClass();

var file_modified = function(branch_manager, file) {
  
  var fqf = branch_manager.getBranchDirectory() + path.sep + file;
  
  fs.readFile(fqf, {encoding:'utf8'}, function(err, body) {
  
    // Prepend branch name to the KV so that the subtree is properly namespaced in Consul
    var key_name = branch_manager.getBranchName() + '/' + file;
    var body = body ? body.trim() : '';
  
    if (err) return console.error('Failed to read directory %s', err);
    console.log('Adding key %s, value %s', key_name, body);
    consul.kv.put(key_name, body, function(err) {
      if (err) return console.error('Failed to put key %s: %s', key_name, require('util').inspect(err));
      console.log('Wrote key %s to consul', key_name);
    });
  });
};

var file_deleted = function(branch_manager, file) {
  // Prepend branch name to the KV so that the subtree is properly namespaced in Consul
  var key_name = branch_manager.getBranchName() + '/' + f.substring(1);
  console.log('Deleting key %s', key_name);
  consul.kv.delete(key_name, function(err) {
    if (err) return console.error('Failed to put key %s: %s', key_name, require('util').inspect(err));
    
    console.log('Deleted key %s from consul', key_name);
  });
};

var process_records = function(branch_manager, records) {
  records.forEach(function(record) {
    console.log('Handling record %s of type %s', record.path, record.type);
    
    switch (record.type) {
      case 'M':
      case 'A':
        // Store added/modified file
        file_modified(branch_manager, record.path);
        break;
      case 'D':
        // Delete file
        file_deleted(branch_manager, record.path);
        break;
      default:
        console.error('Unknown git status %s', record.type);
    }
  });
};

exports.handleRefChange = function(branch_manager, cb) {
  // Handle updating files that are present
  // TODO: Make this more efficient by only tracking deltas.
  
  branch_manager.getCurrentRef(function(err, ref) {
    if (err) return cb("Failed to get current ref for branch " + branch_manager.getBranchName() + " due to " + err);
  
    // If there's a ref present on the branch_manager, diff consul between that branch and the current state
    if (branch_manager.getMostRecentRef()) {
      // Find diffs between most_recent_ref and current_ref
      if (branch_manager.getMostRecentRef() === ref) {
        // We have already processed this update.
        return cb(null, "Ref " + ref + " already processed");
      } else {
        console.log('Delta updating');
        branch_manager.listChangedFiles(branch_manager.getMostRecentRef(), ref, function(err, records) {
          if (err) return cb(err);
          process_records(branch_manager, records);
          cb(null, 'Most recent ref in branch ' + branch_manager.getBranchName() + ' is ' + ref);
        });
      }
      
    } else {
      // If there's no ref from which to do a delta update, we just assume all files in the tree are valid values
      // and pass them to consul.
      branch_manager.listAllFiles(function(err, records) {
        if (err) return cb(err);
        process_records(branch_manager, records);
        branch_manager.setMostRecentRef(ref);
        cb(null, 'Most recent ref in branch ' + branch_manager.getBranchName() + ' is ' + ref);
      });
    }
  });
};
