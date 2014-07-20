
/*!
 * Module dependencies.
 */

var defaults = require('defaults');
var Status = require('./status');
var KV = require('./kv');
var Agent = require('./agent');
var Catalog = require('./catalog');
var Health = require('./health');

/**
 * Export `Consul`.
 */

module.exports = Consul;

/**
 * Consul client.
 *
 * Options
 *
 *  - protocol
 *  - host
 *  - port
 *  - version
 *  - strict
 *
 * @param {Object} opts
 * @param {Boolean} opts.strict
 */

function Consul (opts) {
  if (!(this instanceof Consul)) {
    return new Consul(opts);
  }

  opts = opts || {};

  this.config = defaults(opts, {
    secure: false,
    hostname: 'localhost',
    port: 8500,
    version: 'v1',
    strict: false
  });

  this.status = new Status(this);
  this.kv = new KV(this);
  this.agent = new Agent(this);
  this.catalog = new Catalog(this);
  this.health = new Health(this);
}
