var exec = require('child_process').exec;

var logger = require('./logging.js');

/*
 * Run a command.  If it fails, return the failure message as the first parameter
 * of the callback.  If it succeeds, return a null first parameter and a trimmed
 * stdout as the second parameter. 
 */
var run_command = function(cmd, cwd, cb) {
  logger.trace('Running %s in %s', cmd, cwd);
  var child = exec(cmd, {cwd: cwd}, function(err, stdout, stderr) {
    if (stdout) stdout = stdout.trim();

    if (err) return cb(new Error(err + ' ' + stderr));
    
    cb(null, stdout);
  });
};

exports.init = function(cwd, cb) {
  run_command('git init', cwd, cb);
};

exports.add = function(filename, cwd, cb) {
  run_command('git add ' + filename, cwd, cb);
};

exports.commit = function(message, cwd, cb) {
  run_command('git commit -m "' + message + '"', cwd, cb);
};

exports.clone = function(repo_url, repo_name, branch_name, cwd, cb) {
  run_command('git clone -b ' + branch_name + ' ' + repo_url + ' ' + repo_name, cwd, cb);
};

exports.pull = function(cwd, cb) {
  run_command('git pull', cwd, cb);
};

exports.listChangedFiles = function(from_ref, to_ref, cwd, cb) {
  run_command('git diff --name-status ' + from_ref + ' ' + to_ref, cwd, function(err, output) {
    if (err) return cb(err);
   
    var records = [];
    var lines = output.split('\n');
    lines.forEach(function(line) {
      var tokens = line.split(/\s+/);
      records.push({'type': tokens[0], 'path': tokens[1]});
    });

    cb(null, records);
  });
};

exports.listAllFiles = function(cwd, cb) {
  run_command('git ls-tree --name-status -r HEAD', cwd, function(err, output) {
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
