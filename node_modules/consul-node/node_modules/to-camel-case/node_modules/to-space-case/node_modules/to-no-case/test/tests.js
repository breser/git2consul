describe('to-no-case', function () {

var assert = require('assert');
var none = require('to-no-case');

it('shouldnt touch space case', function () {
  assert('this is a string' == none('this is a string'));
});

it('should remove slug case', function () {
  assert('this is a string' == none('this-is-a-string'));
});

it('should remove snake case', function () {
  assert('this is a string' == none('this_is_a_string'));
});

it('should remove camel case', function () {
  assert('this is a string' == none('thisIsAString'));
});

it('should remove constant case', function () {
  assert('this is a string' == none('THIS_IS_A_STRING'));
});

it('should remove sentence case', function () {
  assert('this is a string.' == none('This is a string.'));
});

it('should remove title case', function () {
  assert('this: is a string' == none('This: Is a String'));
});

});