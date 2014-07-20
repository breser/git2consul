
var Consul = require('..');
var should = require('should');

describe('consul.status', function () {
  var consul;

  beforeEach(function () {
    consul = new Consul();
  });

  describe('#leader', function () {
    it('gets the leader host', function (done) {
      consul.status.leader(function (err, host) {
        if (err) return done(err);
        host.should.eql('127.0.0.1:8300');
        done();
      });
    });
  });

  describe('#peers', function () {
    it('gets all the peer hosts', function (done) {
      consul.status.peers(function (err, hosts) {
        if (err) return done(err);
        hosts.should.be.instanceof(Array);
        hosts.should.include('127.0.0.1:8300');
        done();
      });
    });
  });
});
