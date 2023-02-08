/**
 * Wipe Database before tests are run and
 * after tests are run to ensure a clean test environment.
 */
const Adapter = require('../../../lib/adapter');
const config = require('./config');

// Global Before Helper
before(function(done) {
  dropTable(done);
});

// Global After Helper
after(function(done) {
  dropTable(done);
});

function dropTable(cb) {
  Adapter.registerCollection({ identity: 'test', config: config }, function(err) {
    if(err) {cb(err);}
    Adapter.drop('test', cb);
  });
}
