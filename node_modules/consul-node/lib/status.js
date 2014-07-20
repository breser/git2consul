
/*!
 * Module dependencies.
 */

var Requestor = require('./requestor');

/**
 * Export `Status`.
 */

module.exports = Status;

/**
 * Status constructor.
 *
 * @param {Consul} consol
 * @constructor
 */

function Status (consul) {
  this.requestor = new Requestor('status', consul);
}

/**
 * Leader.
 *
 * TODO: options?
 *
 * @param {Object} [opts]
 * @param {Function} fn
 * @public
 */

Status.prototype.leader = function (opts, fn) {
  if ('function' == typeof opts) fn = opts, opts = null;
  this.requestor.get('leader', opts, fn);
};

/**
 * Peers.
 *
 * TODO: options?
 *
 * @param {Object} [opts]
 * @param {Function} fn
 * @public
 */

Status.prototype.peers = function (opts, fn) {
  if ('function' == typeof opts) fn = opts, opts = null;
  this.requestor.get('peers', opts, fn);
};
