
/*!
 * Module dependencies.
 */

var debug = require('debug')('consul:requestor');
var request = require('request');
var util = require('util');
var url = require('url');
var is = require('is-type');
var camel = require('to-camel-case');

/**
 * Export `Requestor`.
 */

module.exports = Requestor;

/**
 * Requestor.
 *
 * @param {String} endpoint
 * @param {Consul} consul
 * @constructor
 * @private
 */

function Requestor (endpoint, consul) {
  var config = consul.config;
  this.strict = config.strict;
  this.hostname = config.hostname;
  this.port = config.port;
  this.protocol = config.secure ? 'https' : 'http';
  this.pathname = util.format('/%s/%s', config.version, endpoint);
  this.base = url.format(this);
}

/**
 * URL formatting utility.
 *
 * @param {String} path
 * @return {String}
 * @private
 */

Requestor.prototype.urlFor = function (path) {
  return this.base + '/' + path;
};

/**
 * Generic request.
 *
 * TODO: refactor, this is a mess...
 *
 * @param {Object} opts
 * @param {Function} done
 * @private
 */

Requestor.prototype.request = function (opts, done) {
  debug('request %j', opts);
  request(opts, function (err, res, body) {
    if (err) return done(err);
    debug('response %s -- %s', res.statusCode, body);

    // https://github.com/hashicorp/consul/pull/45
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = undefined;
    }

    // todo: moar status codes
    switch (res.statusCode) {
      case 200:
        return done(null, body);
      case 404:
        if (this.strict) {
          err = new Error('not found');
          err.code = 404;
          err.fatal = false;
          body = undefined;
        }
        return done(err);
      default:
        err = new Error('Consul Error');
        err.code = res.statusCode;
        err.body = res.body;
        return done(err);
    }
  }.bind(this));
};

/**
 * GET.
 *
 * TODO: parsing
 *
 * @param {String} path
 * @param {Object|Null} opts
 * @param {Function} done
 * @private
 */

Requestor.prototype.get = function (path, opts, done) {
  this.request({
    method: 'GET',
    url: this.urlFor(path),
    qs: opts,
    encoding: 'utf8'
  }, done);
};

/**
 * PUT.
 *
 * TODO: serialize `data`
 * TODO: parsing
 *
 * @param {String} path
 * @param {Mixed} data
 * @param {Object|Null} opts
 * @param {Function} done
 * @private
 */

Requestor.prototype.put = function (path, data, opts, done) {
  this.request({
    method: 'PUT',
    url: this.urlFor(path),
    qs: opts,
    body: data,
    encoding: 'utf8'
  }, done);
};

/**
 * DELETE.
 *
 * TODO: parsing
 *
 * @param {String} path
 * @param {Object|Null} opts
 * @param {Function} done
 * @private
 */

Requestor.prototype.delete = function (path, opts, done) {
  this.request({
    method: 'DELETE',
    url: this.urlFor(path),
    qs: opts,
    encoding: 'utf8'
  }, done);
};
