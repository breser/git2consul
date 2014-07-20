
var Consul = require('..');
var should = require('should');

describe('consul.catalog', function () {
    var consul;

    beforeEach(function () {
        consul = new Consul();
    });

    // TODO: Extend these tests
    describe('#service', function () {
        it('lists the nodes in a given service', function (done) {
            consul.catalog.service('testservice', function (err, nodes) {
                if (err) return done(err);

                nodes.should.be.instanceOf(Array);
                nodes.length.should.equal(2);
                nodes[0].should.have.property('Node');
                nodes[0].should.have.property('Address');
                nodes[0].should.have.property('ServiceID');
                nodes[0].should.have.property('ServiceName');

                return done();
            });
        });
    });
});
