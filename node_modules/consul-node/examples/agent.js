
var Consul = require('..');
var consul = new Consul();

consul.agent.checks(function (err, checks) {
  if (err) return console.error(err.stack);
  console.log('checks -- %j', checks);
});

consul.agent.services(function (err, services) {
  if (err) return console.error(err.stack);
  console.log('services -- %j', services);
});

consul.agent.members(function (err, members) {
  if (err) return console.error(err.stack);
  console.log('members -- %j', members);
});

