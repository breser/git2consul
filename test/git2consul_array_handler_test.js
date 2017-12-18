var _ = require('underscore');
var should = require('should');

// We want this above any git2consul module to make sure logging gets configured
require('./git2consul_bootstrap_test.js');

var array_key_formatter = require('../lib/array_handler.js');

describe('Array Formatter', function() {
  it ('should ignore non-string values', function() {
    array_key_formatter.create_formatter(false).should.equal(false);
    array_key_formatter.create_formatter(true).should.equal(false);
    array_key_formatter.create_formatter(0).should.equal(false);
    array_key_formatter.create_formatter(NaN).should.equal(false);
    array_key_formatter.create_formatter('none').should.equal(false);
  });

  it ('should format json', function() {
    var format = array_key_formatter.create_formatter('json');
    _.isFunction(format).should.equal(true);
    var arr = ['foo', 'bar'];
    format(arr).should.equal(JSON.stringify(arr));
  });

  it ('should format comma-separated lists', function() {
    var format = array_key_formatter.create_formatter(',');
    _.isFunction(format).should.equal(true);
    var arr = ['foo', 'bar'];
    format(arr).should.equal('foo,bar');
  });

  it ('should format un-separated lists', function() {
    var format = array_key_formatter.create_formatter('');
    _.isFunction(format).should.equal(true);
    var arr = ['foo', 'bar'];
    format(arr).should.equal('foobar');
  });
});

describe('Array Key Formatter', function() {

  it ('should ignore non-format values', function() {
    array_key_formatter.create_key_formatter(false).should.equal(false);
    array_key_formatter.create_key_formatter(true).should.equal(false);
    array_key_formatter.create_key_formatter(0).should.equal(false);
    array_key_formatter.create_key_formatter(NaN).should.equal(false);
    array_key_formatter.create_key_formatter('').should.equal(false);
  });

  it ('should format _#', function() {
    var format = array_key_formatter.create_key_formatter('_#');
    _.isFunction(format).should.equal(true);
    format('foo', 3).should.equal('foo3');
  });

  it ('should format pre_inner#post', function() {
    var format = array_key_formatter.create_key_formatter('pre_inner#post');
    _.isFunction(format).should.equal(true);
    format('foo', 3).should.equal('prefooinner3post');
  });

  it ('should format #_#/_#', function() {
    var format = array_key_formatter.create_key_formatter('#_#/_#');
    _.isFunction(format).should.equal(true);
    format('foo', 3).should.equal('3foo3/foo3');
  });

  it ('should format #_\\#\\_#', function() {
    var format = array_key_formatter.create_key_formatter('#_\\#\\_#');
    _.isFunction(format).should.equal(true);
    format('foo', 3).should.equal('3foo#_3');
  });
});
