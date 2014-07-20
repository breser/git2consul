
var Consul = require('..');
var assert = require('assert');

describe('consul.kv', function () {

  describe('#get', function () {
    describe('when not in "strict mode"', function () {
      var consul = new Consul();
      it('gets undefined from a missing key', function (done) {
        consul.kv.get('missing-1', function (err, host) {
          if (err) return done(err);
          assert(host === undefined);
          done();
        });
      });
    });

    describe('when in "strict mode"', function () {
      var consul = new Consul({ strict: true });
      it('gets an error from a missing key', function (done) {
        consul.kv.get('missing-1', function (err, host) {
          assert(err instanceof Error);
          assert(err.message === 'not found');
          assert(err.code === 404);
          done();
        });
      });
    });
  });

  describe('#put', function () {
    describe('when the key does not exist yet', function () {
      var consul = new Consul();
      it('creates it', function (done) {
        consul.kv.put('hello', 'world', function (err, ok) {
          if (err) return done(err);
          assert(ok === true);
          consul.kv.get('hello', function (err, values) {
            if (err) return done(err);
            assert(Array.isArray(values));
            assert(values.length === 1);
            values.forEach(function (value) {
              assert(value.key === 'hello');
              assert(value.value === 'world');
            });
            done();
          });
        });
      });
    });
  });

});
