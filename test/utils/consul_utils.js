var should = require('should');

var consul = require('consul')();

var logger = require('../../lib/logging.js');

exports.getValue = function(key, cb) {
  consul.kv.get({'key': key}, function(err, value) {
    if (err) return cb(err);

    cb(null, value === undefined ? value : value.Value);
  });
};

exports.setValue = function(key, value, cb) {
  consul.kv.set({'key': key, 'value': value}, function(err, value) {
    if (err) return cb(err);
    cb();
  });
};

exports.getKeyIndices = function(key, cb) {
  consul.kv.get({'key': key}, function(err, value) {
    if (err) return cb(err);

    cb(null,
       value === undefined ? value : value.CreateIndex,
       value === undefined ? value : value.ModifyIndex,
       value === undefined ? value : value.LockIndex);
  });
};

exports.validateValue = function(key, expected_value, cb) {
  logger.trace('Looking for key %s with value %s', key, expected_value);
  exports.getValue(key, function(err, value) {
    if (err) return cb(err);
    if (!expected_value) {
      (value == undefined).should.equal(true);
    } else {
      (value != undefined).should.equal(true);
      value.should.equal(expected_value);
    }
    cb();
  })
};

exports.validateModifyIndex = function(key, expected_value, cb) {
  logger.trace('Looking for key %s with ModifyIndex %s', key, expected_value);
  exports.getKeyIndices(key, function(err, createIndex, modifyIndex, lockIndex) {
    if (err) return cb(err);
    if (!expected_value) {
      (modifyIndex == undefined).should.equal(true);
    } else {
      (modifyIndex != undefined).should.equal(true);
      modifyIndex.should.equal(expected_value);
    }
    cb();
  })
};

var create_wait_function = function(wait_for_present) {
  return function(key, cb) {
    logger.trace('Waiting for key %s', key);
    var check_value = function() {
      exports.getValue(key, function(err, value) {
        if (err) return cb(err);

        if (wait_for_present && value === undefined) {
          return setTimeout(check_value, 50);
        } else if (!wait_for_present && value !== undefined) {
          return setTimeout(check_value, 50);
        }

        // Fire once the wait_for_present criteria is satisfied
        cb();
      });
    };

    setTimeout(check_value, 50);
  };
};

exports.waitForValue = create_wait_function(true);
exports.waitForDelete = create_wait_function(false);

var kill_entry = function(key) {
  logger.trace('Deleting %s', key);
  consul.kv.del(key, function(err) {
    if (err) return console.error(err);
  });
};

exports.purgeKeys = function(test_root, cb) {
  logger.trace('Deleting all keys under %s', test_root);
  consul.kv.get({'key': test_root, recurse: true}, function (err, items) {
    if (err) return console.error(err);

    if (items && items.length > 0) {
      items.forEach(function(item) {
        kill_entry(item.Key);
      });
    }

    // Don't fire the callback until they are all dead and buried
    exports.waitForDelete(test_root + '?recurse', function(err) {
      if (err) return cb(err);
      cb();
    });

  });
}
