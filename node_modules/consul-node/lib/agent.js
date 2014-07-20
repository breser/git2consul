
/*!
 * Module dependencies.
 */

var Requestor = require('./requestor');

/**
 * Export `Agent`.
 */

module.exports = Agent;

/**
 * Agent constructor.
 *
 * @param {Consul} consol
 * @constructor
 */

function Agent (consul) {
  this.requestor = new Requestor('agent', consul);
}

/**
 * Checks.
 *
 * @param {Object} [opts]
 * @param {Function} done
 * @public
 */

Agent.prototype.checks = function (opts, done) {
  if ('function' == typeof opts) done = opts, opts = null;

  this.requestor.get('checks', opts, function (err, checks) {
    if (err) return done(err);
    var mapped = {};

    Object.keys(checks).forEach(function (name) {
      mapped[name] = {
        node: checks[name]['Node'],
        checkId: checks[name]['CheckID'],
        status: checks[name]['Status'],
        notes: checks[name]['Notes'],
        serviceId: checks[name]['ServiceID'],
        serviceName: checks[name]['ServiceName']
      };
    });

    done(null, mapped);
  });
};

/**
 * Services.
 *
 * @param {Object} [opts]
 * @param {Function} done
 * @public
 */

Agent.prototype.services = function (opts, done) {
  if ('function' == typeof opts) done = opts, opts = null;

  this.requestor.get('services', opts, function (err, services) {
    if (err) return done(err);
    var mapped = {};

    Object.keys(services).forEach(function (name) {
      mapped[name] = {
       'id': services[name]['ID'],
       'service': services[name]['Service'],
       'tags': services[name]['Tags'],
       'port': services[name]['Port']
      };
    });

    done(null, mapped);
  });
};

/**
 * Members.
 *
 * @param {Object} [opts]
 * @param {Function} done
 * @public
 */

Agent.prototype.members = function (opts, done) {
  if ('function' == typeof opts) done = opts, opts = null;

  this.requestor.get('members', opts, function (err, members) {
    if (err) return done(err);
    if (!members) return done(null, []);

    done(null, members.map(function (member) {
      return {
        name: member['Name'],
        addr: member['Addr'],
        port: member['Port'],
        tags: member['Tags'],
        status: member['Status'],
        protocolMin: member['ProtocolMin'],
        protocolMax: member['ProtocolMax'],
        protocolCur: member['ProtocolCur'],
        delegateMin: member['DelegateMin'],
        delegateMax: member['DelegateMax'],
        delegateCur: member['DelegateCur']
      };
    }));
  });
};

/**
 * Trigger local agent to join a node.
 *
 * @param {String} address
 * @param {Object} [opts]
 * @param {Function} done
 */
Agent.prototype.join = function (address, opts, done) {
    if ('function' == typeof opts) done = opts, opts = null;

    this.requestor.get('join/' + address, opts, done);
};

/**
 * Force remove node.
 *
 * @param {String} node
 * @param {Object} [opts]
 * @param {Function} done
 */
Agent.prototype.forceLeave = function (node, opts, done) {
    if ('function' == typeof opts) done = opts, opts = null;

    this.requestor.get('force-leave/' + node, opts, done);
};

/**
 * Registers a new local check.
 *
 * @param {Object} check
 * @param {Object} [opts]
 * @param {Function} done
 */
Agent.prototype.registerCheck = function (check, opts, done) {
    if ('function' == typeof opts) done = opts, opts = null;

    this.requestor.put('check/register', check, opts, done);
};

/**
 * Deregister a local check.
 *
 * @param {String} checkId
 * @param {Object} [opts]
 * @param {Function} done
 */
Agent.prototype.deregisterCheck = function (checkId, opts, done) {
    if ('function' == typeof opts) done = opts, opts = null;

    this.requestor.get('check/deregister/' + checkId, opts, done);
};

/**
 * Mark a local test as passing.
 *
 * @param {String} checkId
 * @param {Object} [opts]
 * @param {Function} done
 */
Agent.prototype.passCheck = function (checkId, opts, done) {
    if ('function' == typeof opts) done = opts, opts = null;

    this.requestor.get('check/pass/' + checkId, opts, done);
};

/**
 * Mark a local test as warning.
 *
 * @param {String} checkId
 * @param {Object} [opts]
 * @param {Function} done
 */
Agent.prototype.warnCheck = function (checkId, opts, done) {
    if ('function' == typeof opts) done = opts, opts = null;

    this.requestor.get('check/warn/' + checkId, opts, done);
};

/**
 * Mark a local test as critical.
 *
 * @param {String} checkId
 * @param {Object} [opts]
 * @param {Function} done
 */
Agent.prototype.failCheck = function (checkId, opts, done) {
    if ('function' == typeof opts) done = opts, opts = null;

    this.requestor.get('check/fail/' + checkId, opts, done);
};

/**
 * Registers a new local service.
 *
 * @param {Object} service
 * @param {Object} [opts]
 * @param {Function} done
 */
Agent.prototype.registerService = function (service, opts, done) {
    if ('function' == typeof opts) done = opts, opts = null;

    this.requestor.get('service/register', service, opts, done);
};

/**
 * Deregister a local service.
 *
 * @param {String} serviceId
 * @param {Object} [opts]
 * @param {Function} done
 */
Agent.prototype.deregisterService = function (serviceId, opts, done) {
    if ('function' == typeof opts) done = opts, opts = null;

    this.requestor.get('service/deregister/' + serviceId, opts, done);
};

