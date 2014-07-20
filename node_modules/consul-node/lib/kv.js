
/*!
 * Module dependencies.
 */

var Requestor = require('./requestor');

/**
 * Export `KV`.
 */

module.exports = KV;

/**
 * KV constructor.
 *
 * @param {Consul} consol
 * @constructor
 */

function KV (consul) {
  this.requestor = new Requestor('kv', consul);
}

/**
 * Get `data` from `key`.
 *
 * TODO: options?
 *
 * @param {String} key
 * @param {Function} done
 * @public
 */

KV.prototype.get = function (key, opts, done) {
  if ('function' == typeof opts) done = opts, opts = null;

  this.requestor.get(key, opts, function (err, items) {
    if (err) return done(err);
    if (!items) return done(null, items);

    done(null, items.map(function (item) {
      return {
        createIndex: item['CreateIndex'],
        modifyIndex: item['ModifyIndex'],
        key: item['Key'],
        flags: item['Flags'],
        value: new Buffer(item['Value'], 'base64').toString('utf8')
      };
    }));
  });
};

/**
 * Puts `data` at `key`.
 *
 * TODO: validate `data`
 * TODO: validate `opts.cas`
 * TODO: validate `opts.flags`
 * TODO: serializers for `data`
 *
 * @param {String} key
 * @param {Mixed} data
 * @param {Object} [opts]
 * @param {Function} done
 * @public
 */

KV.prototype.put = function (key, data, opts, done) {
  if ('function' == typeof opts) done = opts, opts = null;
  this.requestor.put(key, data, opts, done);
};

/**
 * DELETE's `key`.
 *
 * TODO: options?
 *
 * @param {String} key
 * @param {Function} done
 * @public
 */

KV.prototype.delete = function (key, opts, done) {
  if ('function' == typeof opts) done = opts, opts = null;
  this.requestor.delete(key, opts, done);
};
