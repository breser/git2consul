describe('to-space-case', function () {

var assert = require('assert');
var space = require('to-space-case');

var strings = {
  camel    : 'thisIsAString',
  space    : 'this is a string',
  snake    : 'this_is_a_string',
  dot      : 'this.is.a.string',
  title    : 'This Is a String',
  constant : 'THIS_IS_A_STRING',
  sentence : 'This is a string.'
};

function convert (key) {
  it('should convert ' + key + ' case', function () {
    assert('this is a string' == space(strings[key]));
  });
}

for (var key in strings) convert(key);

});