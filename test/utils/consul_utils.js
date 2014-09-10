var should = require('should');

var ConsulClass = require('consul-node');
var consul = new ConsulClass();

var logger = require('../../lib/utils/logging.js');

exports.getValue = function(key, cb) {
  consul.kv.get(key, function(err, value) {
    if (err) return cb(err);

    cb(null, value === undefined ? value : value[0].value);
  });
};

exports.validateValue = function(key, expected_value, cb) {
  exports.getValue(key, function(err, value) {
    if (err) return cb(err);
    if (!expected_value) (value == undefined).should.equal(true);
    else {
      (value != undefined).should.equal(true);
      value.should.equal(expected_value);
    }
    cb();
  })
};

var create_wait_function = function(wait_for_present) {
  return function(key, cb) {
    var check_value = function() {
      exports.getValue(key, function(err, value) {
        if (err) return done(err);

        if (wait_for_present && value === undefined) return setTimeout(check_value, 50);
        else if (!wait_for_present && value !== undefined) return setTimeout(check_value, 50);

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
  consul.kv.delete(key, function(err) {
    if (err) return console.error(err);
  });
};

exports.purgeKeys = function(test_root, cb) {
  logger.trace('Deleting all keys under %s', test_root);
  consul.kv.get(test_root + '?recurse', function (err, items) {
    if (err) return console.error(err);

    if (items && items.length > 0) {
      items.forEach(function(item) {
        kill_entry(item.key);
      });
    }

    // Don't fire the callback until they are all dead and buried
    exports.waitForDelete(test_root + '?recurse', function(err) {
      if (err) return cb(err);
      cb();
    });

  });
}
