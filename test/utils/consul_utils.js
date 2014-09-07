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
    if (!expected_value) (value == undefined).should.equal(true)
    else value.should.equal(expected_value);
    cb();
  })
};

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

    cb();
  });
}
