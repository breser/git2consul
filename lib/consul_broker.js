var fs = require('fs');
var path = require('path');

var logger = require('./utils/logging.js');

var ConsulClass = require('consul-node');
var consul = new ConsulClass();

/**
 * If a file was modified, read its new value and update consul's KV store.
 */
var file_modified = function(branch_manager, file, cb) {
  
  var fqf = branch_manager.getBranchDirectory() + path.sep + file;
  
  fs.readFile(fqf, {encoding:'utf8'}, function(err, body) {
  
    // Prepend repo name and branch name to the KV so that the subtree is properly namespaced in Consul
    var key_name = branch_manager.getRepoName() + '/' + branch_manager.getBranchName() + '/' + file;
    var body = body ? body.trim() : '';
  
    if (err) return cb('Failed to read key ' + fqf + ' due to ' + err);
    logger.trace('Adding key %s, value %s', key_name, body);
    consul.kv.put(key_name, body, function(err) {
      if (err) return cb('Failed to delete key ' + key_name + ' due to ' + err);
      cb();
    });
  });
};

/**
 * If a file was deleted, remove it from consul's KV store.
 */
var file_deleted = function(branch_manager, file, cb) {
  // Prepend branch name to the KV so that the subtree is properly namespaced in Consul
  var key_name = branch_manager.getRepoName() + '/' + branch_manager.getBranchName() + '/' + file;
  logger.trace('Deleting key %s', key_name);
  consul.kv.delete(key_name, function(err) {
    if (err) return cb('Failed to delete key ' + key_name + ' due to ' + err);
    cb();
  });
};

/**
 * This function expects an array of objects of the following form:
 *
 *   {
 *       'type': 'Any of [AMTDTC]',
 *       'path': 'Path of the file within the repo'
 *   }
 *
 * This function will loop over those objects, handle them, and fire its callback once all records
 * have been processed.  If any errors were noted in the underlying operations, the callback will
 * include the array of errors as the first parameter.
 */
var process_records = function(branch_manager, records, cb) {
  
  var pending_records = 0;
  var errors_seen = [];
  
  var check_pending = function(err) {
    if (err) errors_seen.push(err);
    
    --pending_records;
    
    // If there are no pending records, callback with all errors seen, if any.
    if (pending_records === 0) cb(errors_seen.length > 0 ? errors_seen : null);
    
    // TODO: Add a watchdog timer?  It's a bit scary that this method may never fire its callback if
    // one of the underlying consul operations hangs, especially since the branch_manager is locked
    // waiting for this update to complete.
  };
  
  records.forEach(function(record) {
    logger.trace('Handling record %s of type %s', record.path, record.type);
    
    switch (record.type) {
      // Update files that were Added (A), Modified (M), or had their type (i.e. regular file, symlink, submodule, ...) changed (T)
      case 'M':
      case 'A':
      case 'T':
        // Store added/modified file
        ++pending_records;
        file_modified(branch_manager, record.path, check_pending);
        break;
      case 'D':
        // Delete file
        ++pending_records;
        file_deleted(branch_manager, record.path, check_pending);
        break;
        // TODO: Test and handle copies and moves. 
      default:
        logger.error('Unknown git status %s', record.type);
    }
  });
};

/**
 * Update consul to match the current state of the branch represented by branch_manager.  In any other case
 * than a fresh clone, we know the prior state of the branch and can determine what files changed since the
 * last time we synced with consul.  In the case of a fresh clone, we just assume that the clone is an accurate
 * representation of what's in consul and add all present files.
 */
exports.handleRefChange = function(branch_manager, cb) {
  
  // First, check to see what the current ref is for this branch.
  branch_manager.getCurrentRef(function(err, ref) {
    if (err) return cb("Failed to get current ref for branch " + branch_manager.getBranchName() + " due to " + err);
    
    /**
     * Given a set of records, process them and update the branch manager to the current ref if successful.
     */
    var handle_records = function(err, records) {
      if (err) return cb(err);
      process_records(branch_manager, records, function(errs) {
        if (errs) return cb("Some consul updates failed:\n" + errs.join('\n'));
        // Note: This is a bit dangerous.  We only update most recent ref is all consul writes are successful.
        // If there's a bug that causes a certain consul write to always fail, we will always create our diffs
        // from the ref before that file was added.
        branch_manager.setMostRecentRef(ref);
        cb(null, 'Most recent ref in branch ' + branch_manager.getBranchName() + ' is ' + ref);
      });
    };
  
    // If there's a ref present on the branch_manager, diff consul between that branch and the current state
    if (branch_manager.getMostRecentRef()) {
      if (branch_manager.getMostRecentRef() === ref) {
        // We have already processed this update.
        return cb(null, "Ref " + ref + " already processed for branch " + branch_manager.getBranchName());
      } else {
        // Find diffs between most_recent_ref and current_ref
        branch_manager.listChangedFiles(branch_manager.getMostRecentRef(), ref, handle_records);
      }
      
    } else {
      // If there's no ref from which to do a delta update, we just assume all files in the tree are valid values
      // and pass them to consul.
      branch_manager.listAllFiles(handle_records);
    }
  });
};
