
/*!
 * Module dependencies.
 */

var Requestor = require('./requestor');

/**
 * Export `Health`.
 */

module.exports = Health;

/**
 * Health constructor.
 *
 * @param {Consul} consul
 * @constructor
 */

function Health (consul) {
    this.requestor = new Requestor('health', consul);
}


/**
 * Returns the health info of a node.
 *
 * @param {String} node
 * @param {Object} [opts]
 * @param {Function} done
 */
Health.prototype.node = function (node, opts, done) {
    if ('function' == typeof opts) done = opts, opts= null;

    this.requestor.get('node/' + node, opts, done);
};

/**
 * Returns the checks of a service.
 *
 * @param {String} service
 * @param {Object} [opts]
 * @param {Function} done
 */
Health.prototype.checks = function (service, opts, done) {
    if ('function' == typeof opts) done = opts, opts= null;

    this.requestor.get('checks/' + service, opts, done);
};

/**
 * Lists the nodes in a given service.
 *
 * @param {String} service
 * @param {Object} [opts]
 * @param {Function} done
 */
Health.prototype.service = function(service, opts, done) {
    if ('function' == typeof opts) done = opts, opts = null;

    this.requestor.get('service/' + service, opts, done);
};

/**
 * Returns the checks in a given state.
 *
 * @param {String} state
 * @param {Object} [opts]
 * @param {Function} done
 */
Health.prototype.state = function (state, opts, done) {
    if ('function' == typeof opts) done = opts, opts= null;

    this.requestor.get('state/' + state, opts, done);
};
