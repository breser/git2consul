var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var utils = require('../utils.js');

var logger = require('../logging.js');

var consul = require('consul')({'host': global.endpoint, 'port': global.port, 'secure': global.secure});

var token = undefined;

const EXPAND_EXTENSIONS = ['json', 'yaml', 'yml', 'properties'];

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

var delete_from_consul = function(key_name, cb) {
  logger.trace('Deleting key %s', key_name);
  consul.kv.del({'key': key_name, token: token}, function(err) {
    if (err) {
      return cb('Failed to delete key ' + key_name + ' due to ' + err);
    }
    cb();
  });
};

/**
 * Given a branch and a file, determine the resource's name in the consul KV store
 */
var create_key_name = function(branch, file, ref) {
  // Add repo name so that the subtree is properly namespaced in Consul
  // unless `ignore_repo_name` is set to true.
  var key_parts = branch.ignore_repo_name ? [] : [branch.repo_name];
  if (branch.mountpoint) key_parts.unshift(branch.mountpoint);

  // Optionally add the branch name
  if (branch.include_branch_name && !ref) {
    key_parts.push(branch.name);
  }

  // Finish with the file path
  if (branch.source_root && !ref) {
    file = file.substring(branch.source_root.length + 1);
  }

  // Remove extension from the key name when expanding an embedded document.
  if (branch.ignore_file_extension && branch.expand_keys) {
    var extension = file.substr(file.lastIndexOf('.') + 1);
    if (_.contains(EXPAND_EXTENSIONS, extension)) {
      file = file.substr(0, file.lastIndexOf('.'));
    }
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
 * After computing the diff between the object and the existing KV records,
 * perform the necessary consul operations such that the state in consul matches
 * the diff.
 */
var populate_kvs_from_object = function(branch, prefix, obj, existing_kvs, cb) {
  var write_kvs = [];
  var delete_kvs = [];
  var candidate_kvs = [];

  render_obj(candidate_kvs, prefix, obj);

  // This avoids unnecessary copying if there are no existing KV records.
  if (existing_kvs.length > 0) {
    diff_kvs(write_kvs, delete_kvs, candidate_kvs, existing_kvs);
  } else {
    write_kvs = candidate_kvs;
  }

  logger.debug('Expandable file %s yielded %s keys (%s writes, %s deletes)',
               prefix,
               candidate_kvs.length,
               write_kvs.length,
               delete_kvs.length);

  // This helps ensure that writes happen after all deletes
  // have been processed.
  var do_writes = _.after(delete_kvs.length, function(err) {
    if (err) return cb(err);

    if (write_kvs.length > 0) {
      cb = _.after(write_kvs.length, cb);
      write_kvs.forEach(function(write) {
        write_content_to_consul(write.key, write.value, cb);
      });
    } else {
      cb();
    }
  });

  if (delete_kvs.length > 0) {
    delete_kvs.forEach(function(del) {
      delete_from_consul(del.key, do_writes);
    });
  } else {
    do_writes();
  }
};

/**
 * Compare the list of candidate KV records to the list of existing KV records.
 * Based on the comparison, populate the provided lists for write and delete
 * operations against the KV store.
 */
var diff_kvs = function(write_kvs, delete_kvs, candidate_kvs, existing_kvs) {
  // If the candidate kv is not already in the list of existing kvs set to the
  // same value, then we know we need to write the kv.
  candidate_kvs.forEach(function(kv) {
    var idx = _.findIndex(existing_kvs, {'key': kv.key });
    if (idx === -1) {
      // key does not exist in the current tree, so we must add it.
      write_kvs.push(kv);
    } else if (kv.value.toString() !== existing_kvs[idx].value) {
      // key exists in the current tree, but has a different value, so we must update it.
      write_kvs.push(kv);
      existing_kvs.splice(idx, 1);
    } else {
      // key exists in the current tree with same value, so we don't need to do anything
      // with it.
      existing_kvs.splice(idx, 1);
    }
  });
  // At this point, anything remaining in the existing_kvs array needs to be 
  // deleted from consul.
  existing_kvs.forEach(function(kv) {
    delete_kvs.push(kv);
  });
};

/**
 * If a file was modified, read its new value and update consul's KV store.
 */
var file_modified = function(branch, file, cb) {

  var handle_json_kv_file = function(file_path, kvs, cb) {
      fs.readFile(file_path, {encoding: 'utf8'}, function (err, body) {
        /* istanbul ignore if */
        if (err) return cb('Failed to read key ' + file_path + ' due to ' + err);
        body = body ? body.trim() : '';
        try {
          var obj = JSON.parse(body);
          populate_kvs_from_object(branch, create_key_name(branch, file), obj, kvs, cb);
        } catch (e) {
          logger.warn("Failed to parse .json file.  Using body string as a KV.");
          write_content_to_consul(create_key_name(branch, file), body, cb);
        }
      });
  };

  var handle_properties_kv_file = function(file_path, common_properties_relative_path, kvs, cb) {
    function extract_and_populate_properties(file_body, common_body, cb) {
      utils.load_properties(file_body, common_body, function (error, obj) {
        if (error) {
          logger.warn('Failed to load properties for : ' + file + ' due to : ' + error + '.' + ' Using body string as a KV.');
          handle_as_flat_file(file_path, branch, file, cb);
        } else {
          populate_kvs_from_object(branch, create_key_name(branch, file), obj, kvs, cb);
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

  var handle_yaml_kv_file = function(file_path, kvs, cb) {
    fs.readFile(file_path, {encoding: 'utf8'}, function (err, body) {
      /* istanbul ignore if */
      if (err) return cb('Failed to read key ' + file_path + ' due to ' + err);
      body = body ? body.trim() : '';
      try {
        var obj = yaml.safeLoad(body);
        populate_kvs_from_object(branch, create_key_name(branch, file), obj, kvs, cb);
      } catch (e) {
        logger.warn("Failed to parse .yaml file " + file + ".  Using body string as a KV.");
        write_content_to_consul(create_key_name(branch, file), body, cb);
      }
    });
  };

  var handle_as_flat_file = function(fqf, branch, file, cb) {
    fs.readFile(fqf, {encoding: 'utf8'}, function (err, body) {
      /* istanbul ignore if */
      if (err) return cb('Failed to read key ' + fqf + ' due to ' + err);
      body = body ? body.trim() : '';
      write_content_to_consul(create_key_name(branch, file), body, cb);
    });
  };

  var handle_expanded_keys_with_different_file_types = function(kvs) {
    if (file.endsWith('.json')) {
      handle_json_kv_file(fqf, kvs, cb);
    } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      handle_yaml_kv_file(fqf, kvs, cb);
    } else if (file.endsWith('.properties')) {
      handle_properties_kv_file(fqf, branch.common_properties, kvs, cb);
    } else {
      handle_as_flat_file(fqf, branch, file, cb);
    }
  };

  var fqf = branch.branch_directory + path.sep + file;
  logger.trace('Attempting to read "%s"', fqf);

  if (branch.expand_keys && branch.expand_keys_diff) {
    // When expand_keys_diff is true we perform a diff and selectively delete/update the current tree.
    get_kvs(branch, file, function(err, kvs) {
      if (err) return cb('Failed to load KV tree ' + create_key_name(branch, file) + ' due to ' + err);
      handle_expanded_keys_with_different_file_types(kvs);
    });
  } else if (branch.expand_keys) {
    // When expand_keys_diff is false we delete the current tree and recreate it.
    file_deleted(branch, file, function (err) {
      if (err) return cb('Failed to delete key ' + create_key_name(branch, file) + ' due to ' + err);
      handle_expanded_keys_with_different_file_types([]);
    });
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
 * Get all KV records under the prefix, and transform them into an array
 * of objects like:
 * [{'key': k, 'value': v}]
 */
var get_kvs = function(branch, file, cb) {
  // Prepend branch name to the KV so that the subtree is properly namespaced in Consuls
  var key_name = create_key_name(branch, file);

  logger.trace('Getting tree for key %s', key_name);

  // Load all sub-keys as a flattened tree of KV pairs
  consul.kv.get({'key': key_name + '/', token: token, recurse: true}, function(err, kvs, res) {
    if (err) return cb('Failed to get tree for key ' + key_name + ' due to ' + err, undefined);

    var tree = []
    if (kvs) {
      kvs.forEach(function(kv) {
        if (kv.Value === null) kv.Value = '';
        logger.trace('Got key %s with value:\n%s', kv.Key, kv.Value);
        tree.push({'key': kv.Key, 'value': kv.Value});
      });
    }

    cb(undefined, tree);
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
