var logger = require('../utils/logging.js');

/**
 * Set up a polling hook to update the git_manager on an interval.  This can
 * be a good failsafe so we aren't totally reliant on hooks making their way
 * to the system.
 */
exports.init = function(config, git_manager) {
  
  // TODO: Validate config.
  
  var start_branch_updater = function(bm) {
    logger.trace('Polling branch %s of repo %s', bm.getBranchName(), git_manager.getRepoName());
    setInterval(function() {
      bm.handleRefChange(null, function(err) {
        if (err) console.error(err);
        logger.debug('Updates in branch %s complete', bm.getBranchName());
      });
    }, config.interval * 60 * 1000);
  };
    
  git_manager.getBranchNames().forEach(function(branch) {
    var bm = git_manager.getBranchManager(branch);
    setTimeout(function() {
      start_branch_updater(bm);
      // Start the branch updater some random number of seconds from 1 to 30.  This is just to space
      // out the updates and reduce load.
    }, ((Math.floor((Math.random() * 30) + 1) ) * 1000)); 
  });
  
  logger.debug('Polling hook initialized with %s minute intervals', config.interval);
};
