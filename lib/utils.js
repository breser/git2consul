var fs = require('fs');
var properties = require ("properties");

/**
 * Check to make sure the provided path is a writable directory. Throw an exception if not.
 */
module.exports.validate_writeable_directory = function(dir) {
  try {
    var stat = fs.lstatSync(dir);
  } catch(e) {
    throw new Error('directory ' + dir + ' does not exist');
  }

  // Check if this process is allowed to write into directory.
  try {
      fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
  } catch(e) {
      throw new Error(dir + ' is not writable');
  }

  if (!stat.isDirectory()) {
    throw new Error(dir + ' is not a directory');
  }
};

var options = {
  path: false,
  variables: true
};

module.exports.load_properties = function (specific_file, common_file, cb){
  properties.parse (common_file, options,
    function (error, env){
      if (error) return cb (error);
      //Pass the common properties as external variables
      options.vars = env;

      properties.parse (specific_file, options, cb);
    });
};