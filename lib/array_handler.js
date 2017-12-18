var _ = require('underscore');
var logger = require('./logging.js');

exports.create_formatter = function create_formatter(array_format) {
  switch (array_format) {
    case 'none':
      return false;
    case 'json':
      return function (arr) {
        return JSON.stringify(arr);
      };
    default:
      if (_.isString(array_format)) {
        return function (arr) {
          return arr.join(array_format);
        };
      }
      if (!_.isUndefined(array_format)) {
        logger.warn("Ignoring array_format because it is set to invalid value '%s' for branch %s in repo %s",
          array_format, this.name, this.repo_name);
      }
      return false;
  }
};

function parse_format(key_token, index_token, format) {
  // Parse the format into a list of tokens that can be output
  var escaping = false;
  var tokens = [];
  var currentToken = "";
  for (var i = 0, formatLength = format.length; i < formatLength; i++) {
    var c = format.charAt(i);
    switch (c) {
      case '\\':
        if (escaping) {
          escaping = false;
          currentToken += c;
        } else {
          escaping = true;
        }
        break;
      case '_':
        if (escaping) {
          escaping = false;
          currentToken += c;
        } else {
          if (currentToken.length > 0) {
            tokens.push(currentToken);
            currentToken = "";
          }
          tokens.push(key_token);
        }
        break;
      case '#':
        if (escaping) {
          escaping = false;
          currentToken += c;
        } else {
          if (currentToken.length > 0) {
            tokens.push(currentToken);
            currentToken = "";
          }
          tokens.push(index_token);
        }
        break;
      default:
        if (escaping) {
          escaping = false;
        }
        currentToken += c;
        break;
    }
  }
  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }
  return tokens;
}

exports.create_key_formatter = function create_key_formatter(format) {
  if (!_.isString(format) || format.length === 0) {
    return false;
  }
  var KEY_TOKEN = {};
  var INDEX_TOKEN = {};
  if (_.isString(format)) {
    var tokens = parse_format(KEY_TOKEN, INDEX_TOKEN, format);
    return function (key, index) {
      var formattedKey = "";
      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        if (token === KEY_TOKEN) {
          formattedKey += encodeURIComponent(key);
        } else if (token === INDEX_TOKEN) {
          formattedKey += index;
        } else {
          formattedKey += token;
        }
      }
      return formattedKey;
    };
  }
  return false;
}