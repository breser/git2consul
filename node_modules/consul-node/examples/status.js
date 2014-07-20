
var Consul = require('..');
var consul = new Consul();

consul.status.peers(function (err, peers) {
  if (err) return console.error(err.stack);
  console.log('peers -- %j', peers);
});

consul.status.leader(function (err, leader) {
  if (err) return console.error(err.stack);
  console.log('leader -- %s', leader);
});
