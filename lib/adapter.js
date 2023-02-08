/*---------------------------------------------------------------
  :: sails-mongo
  -> adapter
---------------------------------------------------------------*/

const util = require('util');
const async = require('async');
const _ = require('@sailshq/lodash');
const ObjectId = require('mongodb').ObjectId;
const Errors = require('waterline-errors').adapter;
const _runJoins = require('waterline-cursor');
const Connection = require('./connection');
const Collection = require('./collection');
const utils = require('./utils');

module.exports = (function() {

  // Keep track of all the connections used by the app
  let connections = {};

  return {

    // Which type of primary key is used by default
    pkFormat: 'string',

    // to track schema internally
    syncable: true,

    // Expose all the connection options with default settings
    defaults: {

      // Connection Configuration
      database: 'sails',

      // Allow a URL Config String
      url: 'mongodb://localhost:27017/sails',

      // DB Options
      writeConcern: {
        w: 1,
        wtimeout: 0,
      },

      readPreference: null,
      forceServerObjectId: false,

      // Server Options
      ssl: false,
      minPoolSize: 5,
      noDelay: true,
      keepAlive: false,
      connectTimeoutMS: 0,
      socketTimeoutMS: 0,

      // Waterline NEXT
      // These are flags that can be toggled today and expose future features. If any of the following are turned
      // on the adapter tests will probably not pass. If you toggle these know what you are getting into.
      wlNext: {

        // Case-sensitive - false
        // In the next version of WL queries will be case-sensitive by default.
        // Set this to true to experiment with that feature today.
        caseSensitive: false,

      },

    },

    /**
     * Register A Connection
     *
     * Will open up a new connection using the configuration provided and store the DB
     * object to run commands off of. This creates a new pool for each connection config.
     *
     * @param {Object} connectionConfig
     * @param {Object} collections
     * @param {Function} cb callback
     */

    registerConnection: function(connectionConfig, collections, cb) {
      if (!connectionConfig.identity) {
        return cb(Errors.IdentityMissing);
      }
      if (connections[connectionConfig.identity]) {
        return cb(Errors.IdentityDuplicate);
      }

      // Merging default options
      connectionConfig = _.defaults(connectionConfig, this.defaults);

      // Store the connection
      connections[connectionConfig.identity] = {
        config: connectionConfig,
        collections: {},
      };

      // Create a new active connection
      new Connection(connectionConfig, function(_err, connection) {

        if (_err) {
          return cb((function _createError() {
            const msg = util.format(
              'Failed to connect to MongoDB.  Are you sure your configured Mongo instance is running?\n Error details:\n%s',
              util.inspect(_err, false, null));
            const err = new Error(msg);
            err.originalError = _err;
            return err;
          })());
        }
        connections[connectionConfig.identity].connection = connection;

        // Build up a registry of collections
        Object.keys(collections).forEach(function(key) {
          connections[connectionConfig.identity].collections[key] = new Collection(collections[key], connection);
        });

        cb();
      });

    },

    /**
     * Teardown
     *
     * Closes the connection pool and removes the connection object from the registry.
     *
     * @param {String} connectionName
     * @param {Function} cb callback
     */

    teardown: async function(connectionName, cb) {
      if (typeof connectionName === 'function') {
        cb = connectionName;
        connectionName = null;
      }
      // if no connection is specified, close all
      if (connectionName === null) {
        const mongoClients = _.pluck(_.pluck(connections, 'connection'), 'client');
        if (mongoClients.length === 0) {
          return cb();
        }

        connections = {};

        return async.each(mongoClients, async function(mongoClient) {
          if (mongoClient === undefined) {
            return;
          }
          await mongoClient.close();
        }, cb);
      }

      if (!connections[connectionName]) {
        return cb();
      }

      const connection = connections[connectionName];
      await connection.connection.client.close();
      delete connections[connectionName];
      cb();

    },

    /**
     * Describe
     *
     * Return the Schema of a collection after first creating the collection
     * and indexes if they don't exist.
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Function} cb callback
     */

    describe: async function(connectionName, collectionName, cb) {

      const connectionObject = connections[connectionName];
      const collection = connectionObject.collections[collectionName];
      const schema = collection.schema;

      let names = [];
      try {
        names = await connectionObject.connection.db.listCollections({name: collectionName}).toArray();
      } catch (err) {
        _.noop(err);
      }

      if (names.length > 0) {
        return cb(null, schema);
      }
      cb();

    },

    /**
     * Define
     *
     * Create a new Mongo Collection and set Index Values
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Object} definition
     * @param {Function} cb callback
     */

    define: function(connectionName, collectionName, definition, cb) {

      const connectionObject = connections[connectionName];
      const collection = connectionObject.collections[collectionName];

      // Create the collection and indexes
      connectionObject.connection.createCollection(collectionName, collection, cb);
    },

    /**
     * Drop
     *
     * Drop a Collection
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Array} relations
     * @param {Function} cb callback
     */

    drop: async function(connectionName, collectionName, relations, cb) {

      if (typeof relations === 'function') {
        cb = relations;
        relations = [];
      }

      const connectionObject = connections[connectionName];
      // Drop the collection and indexes
      connectionObject.connection.dropCollection(collectionName, function(err) {
        // Don't error if droping a collection which doesn't exist
        if (err && err.errmsg === 'ns not found') return cb();
        if (err) {
          return cb(err);
        }
        cb();
      });

    },

    /**
     * Native
     *
     * Give access to a native mongo collection object for running custom
     * queries.
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Function} cb callback
     */

    native: function(connectionName, collectionName, cb) {

      const connectionObject = connections[connectionName];
      cb(null, connectionObject.connection.db.collection(collectionName));

    },

    /**
     * Mongo object with mongoDB native methods
     */

    mongo: {

      /**
       * ObjectId
       *
       * Return a Mongo ObjectID from a string
       *
       * @param {String} id
       */
      objectId: function(id) {
        if (!id) {
          return null;
        }
        try {
          return new ObjectId(id);
          // eslint-disable-next-line no-unused-vars
        } catch (err) {
          return null;
        }
      },

    },

    /**
     * Create
     *
     * Insert a single document into a collection.
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Object} data
     * @param {Function} cb callback
     */

    create: function(connectionName, collectionName, data, cb) {

      const connectionObject = connections[connectionName];
      const collection = connectionObject.collections[collectionName];

      // Insert a new document into the collection
      collection.insert(data, function(err, results) {
        if (err) {
          return cb(utils.clarifyError(err));
        }
        cb(null, results[0]);
      });
    },

    /**
     * Create Each
     *
     * Insert an array of documents into a collection.
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Object} data
     * @param {Function} cb callback
     */

    createEach: function(connectionName, collectionName, data, cb) {

      if (data.length === 0) {
        return cb(null, []);
      }

      const connectionObject = connections[connectionName];
      const collection = connectionObject.collections[collectionName];

      // Insert a new document into the collection
      collection.insert(data, function(err, results) {
        if (err) {
          return cb(utils.clarifyError(err));
        }
        cb(null, results);
      });
    },

    /**
     * Find
     *
     * Find all matching documents in a collection.
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Object} options
     * @param {Function} cb callback
     */

    find: function(connectionName, collectionName, options, cb) {
      options = options || {};
      const connectionObject = connections[connectionName];
      const collection = connectionObject.collections[collectionName];

      // Find all matching documents
      collection.find(options, function(err, results) {
        if (err) {
          return cb(err);
        }
        cb(null, results);
      });
    },

    /**
     * Update
     *
     * Update all documents matching a criteria object in a collection.
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Object} options
     * @param {Object} values
     * @param {Function} cb callback
     */

    update: function(connectionName, collectionName, options, values, cb) {
      options = options || {};
      const connectionObject = connections[connectionName];
      const collection = connectionObject.collections[collectionName];

      // Update matching documents
      collection.update(options, values, function(err, results) {
        if (err) {
          return cb(utils.clarifyError(err));
        }
        cb(null, results);
      });
    },

    /**
     * Destroy
     *
     * Destroy all documents matching a criteria object in a collection.
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Object} options
     * @param {Function} cb callback
     */

    destroy: function(connectionName, collectionName, options, cb) {
      options = options || {};
      const connectionObject = connections[connectionName];
      const collection = connectionObject.collections[collectionName];

      // Find matching documents
      collection.find(options, function(err, results) {
        if (err) {
          return cb(err);
        }

        // Destroy matching documents
        collection.destroy(options, function(err) {
          if (err) {
            return cb(err);
          }
          cb(null, results);
        });
      });
    },

    /**
     * Count
     *
     * Return a count of the number of records matching a criteria.
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Object} options
     * @param {Function} cb callback
     */

    count: function(connectionName, collectionName, options, cb) {
      options = options || {};
      const connectionObject = connections[connectionName];
      const collection = connectionObject.collections[collectionName];

      // Find matching documents and return the count
      collection.count(options, function(err, results) {
        if (err) {
          return cb(err);
        }
        cb(null, results);
      });
    },

    /**
     * Join
     *
     * Performs a join between 2-3 mongo collections when Waterline core
     * needs to satisfy a `.populate()`.
     *
     * @param  {[type]}   connectionName [description]
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   criteria       [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    join: function(connectionName, collectionName, criteria, cb) {

      // Ignore `select` from waterline core
      if (typeof criteria === 'object') {
        delete criteria.select;
      }

      // Populate associated records for each parent result
      // (or do them all at once as an optimization, if possible)
      _runJoins({

        instructions: criteria,
        parentCollection: collectionName,

        /**
         * Find some records directly (using only this adapter)
         * from the specified collection.
         *
         * @param  {String}   collectionIdentity
         * @param  {Object}   criteria
         * @param  {Function} cb
         */
        $find: function(collectionIdentity, criteria, cb) {
          const connectionObject = connections[connectionName];
          const collection = connectionObject.collections[collectionIdentity];
          return collection.find(criteria, cb);
        },

        /**
         * Look up the name of the primary key field
         * for the collection with the specified identity.
         *
         * @param  {String}   collectionIdentity
         * @return {String}
         */
        $getPK: function(collectionIdentity) {
          if (!collectionIdentity) {
            return;
          }
          const connectionObject = connections[connectionName];
          if (!connectionObject) {
            throw new Error(
              'Consistency violation in sails-mongo: Unrecognized datastore (i.e. connection): `' +
              connectionName + '`.');
          }
          const collection = connectionObject.collections[collectionIdentity];
          if (!collection) {
            throw new Error(
              'Consistency violation in sails-mongo: Unrecognized collection: `' +
              collectionIdentity + '` in datastore (i.e. connection): `' +
              connectionName + '`.');
          }
          return collection._getPK();
        },
      }, cb);

    },

    /**
     * Stream
     *
     * Stream one or more documents from the collection
     * using where, limit, skip, and order
     * In where: handle `or`, `and`, and `like` queries
     *
     * @param {String} connectionName
     * @param {String} collectionName
     * @param {Object} options
     * @param {Object} stream
     */
    stream: function(connectionName, collectionName, options, stream) {
      options = options || {};
      const connectionObject = connections[connectionName];
      const collection = connectionObject.collections[collectionName];

      collection.stream(options, stream);
    },

    identity: 'sails-mongo',
  };
})();
