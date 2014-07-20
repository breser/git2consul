
# consul-node

A node.js client library for [consul](http://www.consul.io/)

This module attempts to be "low level" and follows consul's API pretty closely, meaning not a whole lot of sugar is provided for you. If you need something small, sugary and focused, use this module to build something higher level.

## Warning

This not stable because is still being developed, feel free to help out!

## Install

```sh
$ npm install consul-node
```

## Configure

The following options can be passed to the `Consul` constructor.

  - `host` -- The consul agent's host (defaults to `localhost`).
  - `port` -- The consul agent's port (defaults to `8500`).
  - `secure` -- Use https when talking to the agent (defaults to `false`).
  - `strict` -- Treat HTTP 404's as errors (defaults to `false`).

```js
var Consul = require('consul-node');

var consul = new Consul({
  host: 'localhost',
  port: 8300,
});
```

## General

Basically all calls support passing an optional parameter before the callback. This parameter is useful when wanting to pass query string parameters to the calls.

For example, this can be used to filter the services returned by the health endpoint.

```js
// Get all nodes having the 'myservice' service
consul.health.service('myservice', function (err, nodes) {
    if (err) return console.error(err.stack);
    console.log('nodes -- %j', nodes);
});

// Get all healthy ('passing') nodes having the 'myservice' service
consul.health.service('myservice', {passing: 1 }, function (err, nodes) {
    if (err) return console.error(err.stack);
    console.log('nodes -- %j', nodes);
});
```

## KV API

Implements the [KV](http://www.consul.io/docs/agent/http.html#toc_2) endpoints.

  - consul.kv.get(key, callback)
  - consul.kv.put(key, data, callback)
  - consul.kv.delete(key, callback)

TODO: flags, cas, recurse, blocking queries.

```js
var consul = new Consul();

consul.kv.put('hello', 'world', function (err, ok) {
  if (err) throw err;
  consul.kv.get('hello', function (err, items) {
    if (err) throw err;
    console.log(items);
  });
});
```

## Status API

Implements the [status](http://www.consul.io/docs/agent/http.html#toc_29) endpoints.

  - consul.status.leader(callback)
  - consul.status.peers(callback)

```js
var consul = new Consul();

consul.status.peers(function (err, peers) {
  if (err) throw err;
  console.log('peers -- %j', peers);
});

consul.status.leader(function (err, leader) {
  if (err) throw err;
  console.log('leader -- %s', leader);
});
```

## Agent API

Implements the [agent](http://www.consul.io/docs/agent/http.html#toc_3) endpoints.

  - consul.agent.checks(callback)
  - consul.agent.services(callback)
  - consul.agent.members(callback)

Implemented but not yet covered by tests:

 - consul.agent.join(address, callback)
 - consul.agent.forceLeave(node, callback)
 - consul.agent.registerCheck(check, callback)
 - consul.agent.deregisterCheck(checkId, callback)
 - consul.agent.passCheck(checkId, callback)
 - consul.agent.warnCheck(checkId, callback)
 - consul.agent.failCheck(checkId, callback)
 - consul.agent.registerService(service, callback)
 - consul.agent.deregisterService(serviceId, callback)


TODO: Implement tests for the remaining calls.

```js
var consul = new Consul();

consul.agent.checks(function (err, checks) {
  if (err) throw err;
  console.log('checks -- %j', checks);
});

consul.agent.services(function (err, services) {
  if (err) throw err;
  console.log('services -- %j', services);
});

consul.agent.members(function (err, members) {
  if (err) throw err;
  console.log('members -- %j', members);
});
```

### Catalog API

Implements the [catalog](http://www.consul.io/docs/agent/http.html#toc_16) endpoints.

Currently implemented:

 - consul.catalog.service(serviceName, callback)

TODO: Implement the remaining calls.

### Health API

Implements the [health](http://www.consul.io/docs/agent/http.html#toc_24) endpoints.

 - node(node, callback)
 - checks(serviceName, callback)
 - service(serviceName, opts, callback)
 - state(state, callback)

The opts parameter can be used for filtering. Set it to ``{passing: 1}`` to add a query parameter to the request,
which causes the Consul HTTP API to only return service nodes with passing checks.

## Running tests

To run the tests, you have to have the Consul agent running locally.

Start the agent using:

```
// From the consul-node root folder
$ consul agent -config-dir=./test/config/consul.d
```

Then execute the tests using ``npm test``.
