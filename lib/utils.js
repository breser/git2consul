var fs = require('fs');

/**
 * Check to make sure the provided path is a writeable directory.  Throw an exception if not.
 */ 
module.exports.validate_writeable_directory = function(dir) {
  try {
    var stat = fs.lstatSync(dir);
  } catch(e) {
    throw new Error('directory ' + dir + ' does not exist');
  }

  // Check whether this owner or group or anyone is allowed to write the directory.
  var can_write = ((process.getuid() === stat.uid) && (stat.mode & 00200)) || // User is owner and owner can write.
                  ((process.getgid() === stat.gid) && (stat.mode & 00020)) || // User is in group and group can write.
                  ((stat.mode & 00002)); // Anyone can write.
  if (!can_write) {
    throw new Error(dir + ' is not writeable');
  }

  //console.error(require('util').inspect(stat));
  if (!stat.isDirectory()) {
    throw new Error(dir + ' is not a directory');
  }
};