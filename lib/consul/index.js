var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var utils = require('../utils.js');

var logger = require('../logging.js');

var consul = require('consul')({'host': global.endpoint, 'port': global.port, 'secure': global.secure});

var token = undefined;

// This makes life a bit easier for expand_keys mode, allowing us to check for a .json
// extension with less code per line.
String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

/* istanbul ignore next */
exports.setToken = function(tok) {
  token = tok;
}

var write_content_to_consul = function(key_name, content, cb) {
  logger.trace('Adding key %s, value:\n%s', key_name, content);
  consul.kv.set({'key': key_name, value: content !== null ? String(content) : null, token: token}, function(err) {
    if (err) {
      return cb('Failed to write key ' + key_name + ' due to ' + err);
    }
    cb();
  });
};

/**
 * Given a branch and a file, determine the resource's name in the consul KV store
 */
var create_key_name = function(branch, file, ref) {
  // Add repo name so that the subtree is properly namespaced in Consul
  var key_parts = [branch.repo_name];
  if (branch.mountpoint) key_parts.unshift(branch.mountpoint);

  // Optionally add the branch name
  if (branch.include_branch_name && !ref) {
    key_parts.push(branch.name);
  }

  // Finish with the file path
  if (branch.source_root && !ref) {
    file = file.substring(branch.source_root.length + 1);
  }
  key_parts.push(file);
  return key_parts.join('/');
};


/**
 * Given an obj, recurse into it, populating the parts array with all of the key->value
 * relationships, prefixed by parent objs.
 *
 * For example, the obj { 'first': { 'second': { 'third' : 'whee' }}} should yield a
 * parts array with a single entry: 'first/second/third' with value 'whee'.
 */
var render_obj = function(parts, prefix, obj) {

  _.mapObject(obj, function(val, key) {
    if (_.isArray(val)) return;

    if (_.isObject(val)) return render_obj(parts, prefix + '/' + encodeURIComponent(key), val)

    parts.push({'key': prefix + '/' + encodeURIComponent(key), 'value': val});
  });
}

/**
 * Walk through obj, creating a Consul write operation for each kv pair.  Objects are treated
 * as parents of subtrees.  Arrays are ignored since they add annoying problems (multiple array
 * entries can have the same value, so what do we do then?).
 */
var populate_kvs_from_object = function(branch, prefix, obj, cb) {

  var writes = [];

  render_obj(writes, prefix, obj);

  logger.debug('Expandable file %s yielded %s keys', prefix, writes.length);

  cb = _.after(writes.length, cb);

  writes.forEach(function(write) {
    write_content_to_consul(write.key, write.value, cb);
  });
};

/**
 * If a file was modified, read its new value and update consul's KV store.
 */
var file_modified = function(branch, file, cb) {

  var handle_json_kv_file = function(file_path, cb) {
      fs.readFile(file_path, {encoding: 'utf8'}, function (err, body) {
        /* istanbul ignore if */
        if (err) return cb('Failed to read key ' + file_path + ' due to ' + err);
        var body = body ? body.trim() : '';
        try {
          var obj = JSON.parse(body);
          populate_kvs_from_object(branch, create_key_name(branch, file), obj, cb);
        } catch (e) {
          logger.warn("Failed to parse .json file.  Using body string as a KV.");
          write_content_to_consul(create_key_name(branch, file), body, cb);
        }
      });
  };

  var handle_properties_kv_file = function(file_path, common_properties_relative_path, cb) {

    function extract_and_populate_properties(file_body, common_body, cb) {
      utils.load_properties(file_body, common_body, function (error, obj) {
        if (error) {
          logger.warn('Failed to load properties for : ' + file + ' due to : ' + error + '.' + ' Using body string as a KV.');
          handle_as_flat_file(file_path, branch, file, cb);
        } else {
          populate_kvs_from_object(branch, create_key_name(branch, file), obj, cb);
        }
      });
    }

    fs.readFile(file_path, {encoding: 'utf8'}, function (err, file_body) {
      /* istanbul ignore if */
      if (err) return cb('Failed to read key ' + file_path + ' due to ' + err);

      if(common_properties_relative_path) {
        var path_to_common_properties_file = branch.branch_directory + path.sep + common_properties_relative_path;
        fs.readFile(path_to_common_properties_file, {encoding: 'utf8'}, function (err, common_body) {
          if (err) {
            logger.warn('Failed to read common variables for ' + path_to_common_properties_file + ' due to ' + err);
            common_body = '';
          }
          extract_and_populate_properties(file_body, common_body, cb);
        });
      }
      else {
        extract_and_populate_properties(file_body, '', cb);
      }
    });
  };

  var handle_as_flat_file = function(fqf, branch, file, cb) {
    fs.readFile(fqf, {encoding: 'utf8'}, function (err, body) {
      /* istanbul ignore if */
      if (err) return cb('Failed to read key ' + fqf + ' due to ' + err);
      var body = body ? body.trim() : '';
      write_content_to_consul(create_key_name(branch, file), body, cb);
    });
  };

  var handle_expanded_keys_with_different_file_types = function() {
    if (file.endsWith('.json')) {
      // Delete current tree.  Yeah, I know this is kinda the coward's way out, but it's a hell of a lot
      // easier to get provably correct than diffing the file against the contents of the KV store.
      file_deleted(branch, file, function (err) {
        if (err) return cb('Failed to delete key ' + key_name + ' due to ' + err);
        handle_json_kv_file(fqf, cb);
      });
    } else if (file.endsWith('.properties')) {
      file_deleted(branch, file, function (err) {
        if (err) return cb('Failed to delete key ' + key_name + ' due to ' + err);
        handle_properties_kv_file(fqf, branch.common_properties, cb);
      });
    } else {
      handle_as_flat_file(fqf, branch, file, cb);
    }
  };

  var fqf = branch.branch_directory + path.sep + file;
  logger.trace('Attempting to read "%s"', fqf);

  if (branch.expand_keys) {
    handle_expanded_keys_with_different_file_types();
  } else {
    handle_as_flat_file(fqf, branch, file, cb);
  }
};

/**
 * If a file was deleted, remove it from consul's KV store.
 */
var file_deleted = function(branch, file, cb) {
  // Prepend branch name to the KV so that the subtree is properly namespaced in Consuls
  var key_name = create_key_name(branch, file);

  logger.trace('Deleting key %s', key_name);

  // Delete this key.  Or, if mode is branch.expand_keys, delete all files underneath this key.
  consul.kv.del({'key': key_name, token: token, recurse: branch.expand_keys}, function(err) {
    /* istanbul ignore if */
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
var process_records = function(branch, records, cb) {

  var pending_records = 0;
  var errors_seen = [];

  var check_pending = function(err) {
    if (err) {
      errors_seen.push(err);
    }

    --pending_records;

    // If there are no pending records, callback with all errors seen, if any.
    if (pending_records <= 0) {
      _.once(cb((errors_seen.length > 0) ? errors_seen : null));
    }

    // TODO: Add a watchdog timer?  It's a bit scary that this method may never fire its callback
    // if one of the underlying consul operations hangs, especially since the branch is locked
    // waiting for this update to complete.
  };

  records.forEach(function(record) {
    logger.trace('Handling record %s of type %s', record.path, record.type);

    // If we have a source_root set but this file is not within source_root, skip it.
    if (branch.source_root && record.path.indexOf(branch.source_root) !== 0) {
      return check_pending();
    };

    switch (record.type) {
      // Update files that were Added (A), Modified (M), or had their type (i.e. regular file, symlink, submodule, ...) changed (T)
      case 'M':
      case 'A':
      case 'T':
        // Store added/modified file
        // FIXME: This will definitely fail in scenarios where record path is not in branch source root.
        if (record.path === branch.common_properties) {
          ++pending_records;

          file_modified(branch, record.path, function(err) {
            branch.listAdditionalPropertyFiles(records, function(err, additionalRecords) {
              if (err) return check_pending(err);
              if (additionalRecords.length == 0) return check_pending();
              process_records(branch, additionalRecords, function(errs) {
                if (errs) check_pending("Some consul updates failed:\n" + errs.join('\n'));

                check_pending();
              });
            });
          });
        } else {
          ++pending_records;
          file_modified(branch, record.path, check_pending);
        }
        break;
      case 'D':
        // Delete file
        ++pending_records;
        file_deleted(branch, record.path, check_pending);
        break;
      /* istanbul ignore next */
      default:
        logger.error('Unknown git status %s', record.type);
    }
  });
};

/**
 * Get the current ref that has been synced with Consul.
 */
exports.getLastProcessedRef = function(branch, cb) {
  var key_name = create_key_name(branch, branch.name + '.ref', true);
  consul.kv.get({'key': key_name, token: token}, function(err, item) {
    /* istanbul ignore if */
    if (err) return cb(err);
    cb(null, item === undefined ? item : item.Value);
  });
};

/**
 * Store the current ref that has been synced with Consul.
 */
exports.setLastProcessedRef = function(branch, ref, cb) {
  write_content_to_consul(create_key_name(branch, branch.name + '.ref', true), ref, cb);
};

/**
 * Update consul to match the current state of the branch represented by branch_manager.  In any other case
 * than a fresh clone, we know the prior state of the branch and can determine what files changed since the
 * last time we synced with consul.  In the case of a fresh clone, we just assume that the clone is an accurate
 * representation of what's in consul and add all present files.
 */
exports.handleRefChange = function(branch, cb) {

  // First, check to see what the current ref is for this branch.
  branch.getCurrentRef(function(err, ref) {
    /* istanbul ignore if */
    if (err) return cb("Failed to get current ref for branch " + branch.name + " due to " + err);

    /**
     * Given a set of records, process them and update the branch manager to the current ref if successful.
     */
    var handle_records = function(err, records) {
      /* istanbul ignore if */
      if (err) return cb(err);
      process_records(branch, records, function(errs) {
        if (errs) {
          return cb("Some consul updates failed:\n" + errs.join('\n'));
        }
        // Note: This is a bit dangerous.  We only update most recent ref if all consul writes are successful.
        // If there's a bug that causes a certain consul write to always fail, we will always create our diffs
        // from the ref before that file was added.
        exports.setLastProcessedRef(branch, ref, function(err) {
          return cb(err);
        });
      });
    };

    // If there's a ref present on the branch_manager, diff consul between that branch and the current state
    exports.getLastProcessedRef(branch, function(err, last_processed_ref) {
      /* istanbul ignore if */
      if (err) return cb(err);

      if (!last_processed_ref) {
        // If there's no ref from which to do a delta update, we just assume all files in the tree are valid values
        // and pass them to consul.
        branch.listAllFiles(handle_records);
      } else {
        if (last_processed_ref === ref) {
          // We have already processed this update.
          return cb(null, "Ref " + ref + " already processed for branch " + branch.name);
        } else {
          // Find diffs between most_recent_ref and current_ref
          branch.listChangedFiles(last_processed_ref, ref, handle_records);
        }
      }
    });
  });
};

