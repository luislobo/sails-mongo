const Adapter = require('../../lib/adapter');
const Config = require('../support/config');
const Fixture = require('../support/fixture');
const assert = require('assert');
const async = require('async');

describe('adapter', function () {

  before(function (done) {
    let Schema;

    const connectionDefinition = Config;
    connectionDefinition.identity = 'test';

    const collection = {identity: 'foobar', definition: Fixture};
    collection.definition.connectionDefinition = 'test';

    Adapter.registerConnection(connectionDefinition, { 'foobar': collection }, done);
  });

  after(function (done) {
    let Schema;

    const connection = Config;
    connection.identity = 'test';

    const collection = {identity: 'foobar', definition: Fixture};
    collection.definition.connection = 'test';

    Adapter.teardown(done);
  });

  describe('.native() callback', function () {

    it('should allow direct access to the collection object', function (done) {

      Adapter.native('test', 'foobar', async function (err, collection) {
        assert(!err);

        // Attempt to insert a document
        try {
          const objects = await collection.insertOne({hello: 'world'}, {w: 1});
        } catch (err) {
          done(err);
        }
        // check that the record was actually inserted
        try {
          const doc = await collection.findOne({hello: 'world'});
          assert(doc.hello === 'world');
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });

});
