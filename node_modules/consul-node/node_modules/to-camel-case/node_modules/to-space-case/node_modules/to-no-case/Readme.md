# to-no-case

  Remove an existing case from a string.

## Installation

    $ component install ianstormtaylor/to-no-case
    $ npm install to-no-case

## Example

```js
var clean = require('to-no-case');

clean('camelCase');       // "camel case"
clean('snake_case');      // "snake case"
clean('slug-case');       // "slug case"
clean('Title of Case');   // "title of case"
clean('Sentence case.');  // "sentence case."
```

## API

### toNoCase(string)
  
  Returns the `string` with an existing case removed.

## License

  MIT
