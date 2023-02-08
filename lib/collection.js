/**
 * Module dependencies
 */
const _ = require('@sailshq/lodash');
const Errors = require('waterline-errors').adapter;
const utils = require('./utils');
const Document = require('./document');
const Query = require('./query');

/**
 * Manage A Collection
 *
 * @param {Object} definition
 * @param {Object} connection
 * @api public
 */
const Collection = module.exports = function Collection(definition, connection) {

  // Set an identity for this collection
  this.identity = '';

  // Hold Schema Information
  this.schema = null;

  // Hold a reference to an active connection
  this.connection = connection;

  // Hold the config object
  const connectionConfig = connection.config || {};
  this.config = _.extend({}, connectionConfig.wlNext);

  // Hold Indexes
  this.indexes = [];

  // Parse the definition into collection attributes
  this._parseDefinition(definition);

  // Build an indexes dictionary
  this._buildIndexes();

  return this;
};

/////////////////////////////////////////////////////////////////////////////////
// PUBLIC METHODS
/////////////////////////////////////////////////////////////////////////////////

/**
 * Find Documents
 *
 * @param {Object} criteria
 * @param {Function} callback
 * @api public
 */

Collection.prototype.find = async function find(criteria, cb) {

  const self = this;
  let query;

  // Catch errors from building query and return to the callback
  try {
    query = new Query(criteria, this.schema, this.config);
  } catch (err) {
    return cb(err);
  }

  const _mdbCollection = this.connection.db.collection(self.identity);

  // Check for aggregate query
  if (query.aggregate) {
    const aggregate = [
      {'$match': query.criteria.where || {}},
      {'$group': query.aggregateGroup},
    ];

    try {
      const results = await _mdbCollection.aggregate(aggregate).toArray();

      // Results have grouped by values under _id, so we extract them
      const mapped = results.map(function(result) {
        for (const key in result._id) {
          result[key] = result._id[key];
        }
        delete result._id;
        return result;
      });

      return cb(null, mapped);
    } catch (err) {
      return cb(err);
    }
  }

  const where = query.criteria.where || {};
  const project = query.select || {};
  const queryOptions = _.omit(query.criteria, ['where', 'select']);

  // Run Normal Query on collection
  try {
    const docs = await _mdbCollection.find(where, queryOptions).project(project).toArray();
    return cb(null, utils.normalizeResults(docs, self.schema));
  } catch (err) {
    return cb(err);
  }
};

/**
 * Stream Documents
 *
 * @param {Object} criteria
 * @param {Object} stream
 * @api public
 */
Collection.prototype.stream = function find(criteria, stream) {
  const self = this;
  let query;

  // Ignore `select` from waterline core
  if (typeof criteria === 'object') {
    delete criteria.select;
  }

  // Catch errors from building query and return to the callback
  try {
    query = new Query(criteria, this.schema, this.config);
  } catch (err) {
    return stream.end(err); // End stream
  }

  const _mdbCollection = this.connection.db.collection(self.identity);

  const where = query.criteria.where || {};
  const project = query.select || {};
  const queryOptions = _.omit(query.criteria, ['where', 'select']);

  // Run Normal Query on collection
  const dbStream = _mdbCollection.find(where, queryOptions).project(project).stream();

  // For each data item
  dbStream.on('data', function(item) {
    // Pause stream
    dbStream.pause();

    const obj = utils.rewriteIds([item], self.schema)[0];

    stream.write(obj, function() {
      dbStream.resume();
    });

  });

  // Handle error, an 'end' event will be emitted after this as well
  dbStream.on('error', function(err) {
    stream.end(err); // End stream
  });

  // all rows have been received
  dbStream.on('close', function() {
    stream.end();
  });
  // stream has ended
  dbStream.on('end', function() {
    stream.end();
  });
};

/**
 * Insert A New Document
 *
 * @param {Object|Array} values
 * @param {Function} callback
 * @api public
 */

Collection.prototype.insert = async function insert(values, cb) {

  const self = this;

  // Normalize values to an array
  if (!Array.isArray(values)) {
    values = [values];
  }

  // Build a Document and add the values to a new array
  const docs = values.map(function(value) {
    return new Document(value, self.schema).values;
  });

  try {
    const results = await this.connection.db.collection(this.identity).insertMany(docs);
    // MongoDB no longer return documents
    // https://github.com/mongodb/node-mongodb-native/blob/HEAD/etc/notes/CHANGES_4.0.0.md#crud-results
    const resultIds = _.map(results.insertedIds, doc => doc);
    await this.find({where: {id: resultIds}}, cb);
  } catch (err) {
    return cb(err);
  }
};

/**
 * Update Documents
 *
 * @param {Object} criteria
 * @param {Object} values
 * @param {Function} callback
 * @api public
 */

Collection.prototype.update = async function update(criteria, values, cb) {
  const self = this;
  let query;

  // Ignore `select` from waterline core
  if (typeof criteria === 'object') {
    delete criteria.select;
  }

  // Catch errors build query and return to the callback
  try {
    query = new Query(criteria, this.schema, this.config);
  } catch (err) {
    return cb(err);
  }

  values = new Document(values, this.schema).values;

  // Mongo doesn't allow ID's to be updated
  if (values.id) {
    delete values.id;
  }
  if (values._id) {
    delete values._id;
  }

  const _mdbCollection = this.connection.db.collection(self.identity);

  // Lookup records being updated and grab their ID's
  // Useful for later looking up the record after an insert
  // Required because options may not contain an ID

  try {
    let records = await _mdbCollection.find(query.criteria.where).project({_id: 1}).toArray();

    if (!records) {
      return cb(Errors.NotFound);
    }

    // Build an array of records
    const updatedRecordIds = [];

    records.forEach(function(record) {
      updatedRecordIds.push(record._id);
    });

    // Update the records
    await _mdbCollection.updateMany(query.criteria.where, {'$set': values});

    // Look up newly inserted records to return the results of the update
    records = await _mdbCollection.find({_id: {'$in': updatedRecordIds}}).toArray();

    return cb(null, utils.rewriteIds(records, self.schema));

  } catch (err) {
    return cb(err);
  }

};

/**
 * Destroy Documents
 *
 * @param {Object} criteria
 * @param {Function} callback
 * @api public
 */

Collection.prototype.destroy = async function destroy(criteria, cb) {
  const self = this;
  let query;

  // Ignore `select` from waterline core
  if (typeof criteria === 'object') {
    delete criteria.select;
  }

  // Catch errors build query and return to the callback
  try {
    query = new Query(criteria, this.schema, this.config);
  } catch (err) {
    return cb(err);
  }

  const _mdbCollection = this.connection.db.collection(self.identity);

  try {

    const records = await _mdbCollection.find(query.criteria.where).toArray();

    if (!records) {
      return cb(Errors.NotFound);
    }

    await _mdbCollection.deleteMany(query.criteria.where);

    return cb(null, utils.rewriteIds(records, self.schema));

  } catch (err) {
    return cb(err);
  }

};

/**
 * Count Documents
 *
 * @param {Object} criteria
 * @param {Function} callback
 * @api public
 */

Collection.prototype.count = async function count(criteria, cb) {

  let query;

  // Ignore `select` from waterline core
  if (typeof criteria === 'object') {
    delete criteria.select;
  }

  // Catch errors build query and return to the callback
  try {
    query = new Query(criteria, this.schema, this.config);
  } catch (err) {
    return cb(err);
  }

  try {
    const count = await this.connection.db.collection(this.identity).countDocuments(query.criteria.where);
    return cb(null, count);
  } catch (err) {
    return cb(err);
  }
};

/////////////////////////////////////////////////////////////////////////////////
// PRIVATE METHODS
/////////////////////////////////////////////////////////////////////////////////

/**
 * Get name of primary key field for this collection
 *
 * @return {String}
 * @api private
 */
Collection.prototype._getPK = function _getPK() {
  const self = this;
  let pk;

  _.keys(this.schema).forEach(function(key) {
    if (self.schema[key].primaryKey) {
      pk = key;
    }
  });

  if (!pk) {
    pk = 'id';
  }
  return pk;
};

/**
 * Parse Collection Definition
 *
 * @param {Object} definition
 * @api private
 */

Collection.prototype._parseDefinition = function _parseDefinition(definition) {
  const self = this;

  // Hold the Schema
  this.schema = _.cloneDeep(definition.definition);

  if (_.has(this.schema, 'id') && this.schema.id.primaryKey && this.schema.id.type === 'integer') {
    this.schema.id.type = 'objectid';
  }

  // Remove any Auto-Increment Keys, Mongo currently doesn't handle this well without
  // creating additional collection for keeping track of the increment values
  Object.keys(this.schema).forEach(function(key) {
    if (self.schema[key].autoIncrement) {
      delete self.schema[key].autoIncrement;
    }
  });

  // Replace any foreign key value types with ObjectId
  Object.keys(this.schema).forEach(function(key) {
    if (self.schema[key].foreignKey) {
      self.schema[key].type = 'objectid';
    }
  });

  // Set the identity
  const ident = definition.tableName ?
    definition.tableName :
    definition.identity.toLowerCase();
  this.identity = _.clone(ident);
};

/**
 * Build Internal Indexes Dictionary based on the current schema.
 *
 * @api private
 */

Collection.prototype._buildIndexes = function _buildIndexes() {
  const self = this;

  Object.keys(this.schema).forEach(function(key) {
    const index = {};
    const options = {};

    // If index key is `id` ignore it because Mongo will automatically handle this
    if (key === 'id') {
      return;
    }

    // Handle Unique Indexes
    if (self.schema[key].unique) {

      // Set the index sort direction, doesn't matter for single key indexes
      index[key] = 1;

      // Set the index options
      options.sparse = true;
      options.unique = true;

      // Store the index in the collection
      self.indexes.push({index: index, options: options});
      return;
    }

    // Handle non-unique indexes
    if (self.schema[key].index) {

      // Set the index sort direction, doesn't matter for single key indexes
      index[key] = 1;

      // Set the index options
      options.sparse = true;

      // Store the index in the collection
      self.indexes.push({index: index, options: options});
      return;
    }
  });
};
