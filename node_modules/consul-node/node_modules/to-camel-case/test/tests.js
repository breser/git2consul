describe('to-camel-case', function () {

var assert = require('assert');
var camel = require('to-camel-case');

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
    assert('thisIsAString' == camel(strings[key]));
  });
}

for (var key in strings) convert(key);

});