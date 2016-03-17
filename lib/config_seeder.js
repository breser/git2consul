var fs = require('fs');
var _ = require('underscore');

var consul = require('consul')({'host': global.endpoint, 'port': global.port, 'secure': global.secure});
var logger = require('./logging.js');

/**
 * This utility adds keys from the top level of a .json config file to the /git2consul/ path of
 * Consul.  We use this to seed Consul's KV with the bootstrapping information used by git2consul.
 */
exports.set = function(kv_path, config_file, cb) {
  if (!cb) {
    cb = config_file;
    config_file = kv_path;
    kv_path = 'git2consul/config';
  }

  var config = fs.readFileSync(config_file, {'encoding':'utf8'});

  // Verify that the config is valid JSON
  try {
    JSON.parse(config);
  } catch(err) {
    logger.error('config_file is not valid JSON');
    return cb(err)
  }

  logger.info('Adding %s to KV %s as: \n%s', config_file, kv_path, config);

  var params = {'key': kv_path, 'value': config};

  if (global.token) {
    params = _.extend(params, {'token': global.token})
  }

  consul.kv.set(params, function(err, result){
    if (err) return cb(err);

    cb(null);
  });
};
