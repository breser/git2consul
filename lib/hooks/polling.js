var logger = require('../utils/logging.js');

/**
 * Set up a polling hook to update the git_manager on an interval.  This can
 * be a good failsafe so we aren't totally reliant on hooks making their way
 * to the system.
 */
exports.init = function(config, git_manager, mock) {

  if (!config.interval || config.interval < 0 || parseInt(config.interval) != config.interval)
    throw 'Polling intervals must be positive integers'

  var start_branch_updater = function(bm) {
    logger.trace('Polling branch %s of repo %s', bm.getBranchName(), git_manager.getRepoName());
    setInterval(function() {
      bm.handleRefChange(null, function(err) {
        /* istanbul ignore next */
        if (err) logger.error(err);
        logger.debug('Updates in branch %s complete', bm.getBranchName());
      });
    }, mock ? 1000 /* istanbul ignore next */ :
      config.interval * 60 * 1000);
  };

  git_manager.getBranchNames().forEach(function(branch) {
    var bm = git_manager.getBranchManager(branch);
    setTimeout(function() {
      start_branch_updater(bm);
      // Start the branch updater some random number of seconds from 1 to 30.  This is just to space
      // out the updates and reduce load spikes against git servers.
    }, mock ? 10 : /* istanbul ignore next */ 
      ((Math.floor((Math.random() * 30) + 1) ) * 1000)); // In the common case, start polling a random number of seconds later.
  });

  logger.debug('Polling hook initialized with %s minute intervals', config.interval);
};
