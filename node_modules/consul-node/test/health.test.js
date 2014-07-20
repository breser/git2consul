
var Consul = require('..');
var should = require('should');

// TODO: Extend these tests
describe('consul.health', function () {
    var consul;

    beforeEach(function () {
        consul = new Consul();
    });

    describe('#node', function () {
        it('returns the health info of a node', function (done) {
            consul.health.node('test-node1', function (err, healthInfo) {
                if (err) return done(err);

                healthInfo.should.be.instanceOf(Array);
                healthInfo.length.should.be.greaterThan(0);
                healthInfo[0].Node.should.equal('test-node1');

                return done();
            });
        });
    });

    // TODO: Extend to cover passing flags
    describe('#checks', function () {
        it('returns the checks of a service', function (done) {
            consul.health.checks('testservice', function (err, checks) {
                if (err) return done(err);

                checks.should.be.instanceOf(Array);
                checks.length.should.equal(1);
                checks[0].Node.should.equal('test-node1');
                checks[0].ServiceID.should.equal('testservice2_check');

                return done();
            });
        });
    });


    describe('#service', function () {
        it('lists the nodes in a given service', function (done) {
            consul.health.service('testservice', function (err, nodes) {
                if (err) return done(err);

                nodes.should.be.instanceOf(Array);
                nodes.length.should.equal(2);

                return done();
            });
        });

        it('returns only healthy service nodes when "passing" flag is passed', function (done) {
            consul.health.service('testservice', {passing: 1 }, function (err, nodes) {
                if (err) return done(err);

                nodes.should.be.instanceOf(Array);
                nodes.length.should.equal(1);

                return done();
            });
        });
    });

    // TODO: Possibly extend to contain a test for "warning" checks?
    describe('#state', function () {
        it('returns the checks that are passing', function (done) {
            consul.health.state('passing', function (err, checks) {
                if (err) return done(err);

                checks.should.be.instanceOf(Array);
                checks.length.should.equal(1);
                checks[0].CheckID.should.equal('serfHealth');
                checks[0].Status.should.equal('passing');

                return done();
            });
        });

        it('returns the checks that are critical', function (done) {
            consul.health.state('critical', function (err, checks) {
                if (err) return done(err);

                checks.should.be.instanceOf(Array);
                checks.length.should.equal(1);
                checks[0].CheckID.should.equal('service:testservice2_check');
                checks[0].Status.should.equal('critical');

                return done();
            });
        });
    });
});
