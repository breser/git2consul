var exec = require('child_process').exec;

var logger = require('../logging.js');

/*
 * Run a command.  If it fails, return the failure message as the first parameter
 * of the callback.  If it succeeds, return a null first parameter and a trimmed
 * stdout as the second parameter.
 */
var run_command = function(cmd, cwd, cb) {
  logger.trace('Running %s in %s', cmd, cwd);
  var child = exec(cmd, {cwd: cwd}, function(err, stdout, stderr) {
    if (stdout) stdout = stdout.trim();

    logger.trace("stdout: " + stdout);
    logger.trace("stderr: " + stderr);

    if (err) {
      return cb(new Error(err + ' ' + stderr));
    }

    cb(null, stdout);
  });
};

exports.init = function(cwd, cb) {
  run_command('git init', cwd, cb);
};

exports.add = function(filename, cwd, cb) {
  run_command('git add "' + filename + '"', cwd, cb);
};

exports.mv = function(old_file, new_file, cwd, cb) {
  run_command('git mv "' + old_file + '" "' + new_file + '"', cwd, cb);
};

exports.delete = function(filename, cwd, cb) {
  run_command('git rm "' + filename + '"', cwd, cb);
};

exports.commit = function(message, cwd, cb) {
  run_command('git commit -m "' + message + '"', cwd, cb);
};

exports.checkout_branch = function(branch_name, cwd, cb) {
  run_command('git checkout -b ' + branch_name, cwd, cb);
};

exports.clone = function(repo_url, branch_name, cwd, cb) {
  run_command('git clone -b ' + branch_name + ' ' + repo_url + ' ' + branch_name, cwd, cb);
};

exports.pull = function(cwd, cb) {
  run_command('git pull', cwd, cb);
};

var fixup_path = function(path) {
  if ((path.charAt(0) === '"') && (path.charAt(path.length-1) === '"')) {
    path = path.substring(1, path.length-1);
  }

  path = path.replace(/\\\\/g, '\\');

  return path;
};

exports.listChangedFiles = function(from_ref, to_ref, cwd, cb) {
  run_command('git diff --name-status ' + from_ref + ' ' + to_ref, cwd, function(err, output) {
    /* istanbul ignore if */
    if (err) return cb(err);

    var records = [];
    var lines = output.split('\n');
    lines.forEach(function(line) {
      /* istanbul ignore if */
      if (line.length < 2) return;
      var type = line.charAt(0);
      var rest = fixup_path(line.substring(1).trim());

      logger.trace(rest);
      records.push({'type': type, 'path': rest});
    });

    cb(null, records);
  });
};

exports.listAllFiles = function(cwd, cb) {
  run_command('git ls-tree --name-status -r HEAD', cwd, function(err, output) {
    /* istanbul ignore if */
    if (err) return cb(err);

    var records = [];
    var files = output.split('\n');
    files.forEach(function(file) {
      records.push({'type': 'M', 'path': file});
    });

    cb(null, records);
  });
};

exports.getCurrentRef = function(cwd, cb) {
  run_command('git log -n 1 --pretty=format:"%H"', cwd, cb);
};
