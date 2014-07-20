
var Consul = require('..');
var consul = new Consul();

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
