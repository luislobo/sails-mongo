/**
 * Module dependencies
 */
const async = require('async');
const MongoClient = require('mongodb').MongoClient;
const _ = require('@sailshq/lodash');

/**
 * Manage a connection to a Mongo Server
 *
 * @param {Object} config
 * @param {Function} cb callback
 * @return {Object}
 * @api private
 */
const Connection = module.exports = function Connection(config, cb) {
  const self = this;

  // Hold the config object
  this.config = config || {};

  // Build Database connection
  this._buildConnection(function(err, db, client) {
    if (err) {
      return cb(err);
    }
    if (!db) {
      return cb(new Error('no db object'));
    }

    if (!client) {
      return cb(new Error('no client object'));
    }

    // Store the DB object
    self.db = db;

    // Store the client object
    self.client = client;

    // Return the connection
    cb(null, self);
  });
};

/////////////////////////////////////////////////////////////////////////////////
// PUBLIC METHODS
/////////////////////////////////////////////////////////////////////////////////

/**
 * Create A Collection
 *
 * @param {String} name
 * @param {Object} collection
 * @param {Function} callback
 * @api public
 */

Connection.prototype.createCollection = async function createCollection(
  name, collectionSpec, cb) {
  const self = this;

  // Create the Collection
  try {
    const result = await this.db.createCollection(name);
    // Create Indexes
    await self._createIndexes(result, collectionSpec.indexes, cb);
  } catch (err) {
    return cb(err);
  }
};

/**
 * Drop A Collection
 *
 * @param {String} name
 * @param {Function} callback
 * @api public
 */

Connection.prototype.dropCollection = async function dropCollection(name, cb) {
  // Drop the Collection
  try {
    const result = await this.db.dropCollection(name);
    return cb(null, result);
  } catch (err) {
    return cb(err);
  }
};

/////////////////////////////////////////////////////////////////////////////////
// PRIVATE METHODS
/////////////////////////////////////////////////////////////////////////////////

/**
 * Build Server and Database Connection Objects
 *
 * @param {Function} callback
 * @api private
 */

Connection.prototype._buildConnection = function _buildConnection(cb) {

  // Set the configured options
  const connectionOptions = {
    ALPNProtocols: this.config.ALPNProtocols,
    appName: this.config.appname || this.config.appName,
    auth: this.config.auth,
    authMechanism: this.config.authMechanism,
    authMechanismProperties: this.config.authMechanismProperties,
    authSource: this.config.authSource,
    autoEncryption: this.config.autoEncryption,
    bsonRegExp: this.config.bsonRegExp,
    ca: this.config.ca,
    cert: this.config.cert,
    checkKeys: this.config.checkKeys,
    checkServerIdentity: this.config.checkServerIdentity,
    ciphers: this.config.ciphers,
    compressors: this.config.compressors,
    connectTimeoutMS: this.config.connectTimeoutMS,
    crl: this.config.crl,
    directConnection: this.config.directConnection,
    driverInfo: this.config.driverInfo,
    ecdhCurve: this.config.ecdhCurve,
    enableUtf8Validation: this.config.enableUtf8Validation,
    family: this.config.family,
    fieldAsRaw: this.config.fieldAsRaw,
    forceServerObjectId: this.config.forceServerObjectId,
    heartbeatFrequencyMS: this.config.heartbeatFrequencyMS,
    hints: this.config.hints,
    ignoreUndefined: this.config.ignoreUndefined,
    journal: this.config.journal,
    keepAlive: Boolean(this.config.keepAlive),
    keepAliveInitialDelay: this.config.keepAliveInitialDelay,
    key: this.config.key,
    loadBalanced: this.config.loadBalanced,
    localAddress: this.config.localAddress,
    localPort: this.config.localPort,
    localThresholdMS: this.config.localThresholdMS,
    lookup: this.config.lookup,
    maxConnecting: this.config.maxConnecting,
    maxIdleTimeMS: this.config.maxIdleTimeMS,
    maxPoolSize: this.config.maxPoolSize,
    maxStalenessSeconds: this.config.maxStalenessSeconds,
    minDHSize: this.config.minDHSize,
    minHeartbeatFrequencyMS: this.config.minHeartbeatFrequencyMS,
    minPoolSize: this.config.minPoolSize,
    monitorCommands: this.config.monitorCommands,
    noDelay: this.config.noDelay,
    passphrase: this.config.passphrase,
    pfx: this.config.pfx,
    pkFactory: this.config.pkFactory,
    promoteBuffers: this.config.promoteBuffers,
    promoteLongs: this.config.promoteLongs,
    promoteValues: this.config.promoteValues,
    proxyHost: this.config.proxyHost,
    proxyPassword: this.config.proxyPassword,
    proxyPort: this.config.proxyPort,
    proxyUsername: this.config.proxyUsername,
    raw: this.config.raw,
    readConcern: this.config.readConcern,
    readConcernLevel: this.config.readConcernLevel,
    readPreference: this.config.readPreference,
    readPreferenceTags: this.config.readPreferenceTags,
    rejectUnauthorized: this.config.rejectUnauthorized,
    replicaSet: this.config.replicaSet,
    retryReads: this.config.retryReads,
    retryWrites: this.config.retryWrites,
    secureContext: this.config.secureContext,
    secureProtocol: this.config.secureProtocol,
    serializeFunctions: this.config.serializeFunctions,
    serverApi: this.config.serverApi,
    serverSelectionTimeoutMS: this.config.serverSelectionTimeoutMS,
    servername: this.config.servername,
    session: this.config.session,
    socketTimeoutMS: this.config.socketTimeoutMS,
    srvMaxHosts: this.config.srvMaxHosts,
    srvServiceName: this.config.srvServiceName,
    ssl: this.config.ssl,
    sslCA: this.config.sslCA,
    sslCert: this.config.sslCert,
    sslCRL: this.config.sslCRL,
    sslKey: this.config.sslKey,
    sslPass: this.config.sslPass,
    sslValidate: this.config.sslValidate,
    tls: this.config.tls,
    tlsAllowInvalidCertificates: this.config.tlsAllowInvalidCertificates,
    tlsAllowInvalidHostnames: this.config.tlsAllowInvalidHostnames,
    tlsCAFile: this.config.tlsCAFile,
    tlsCertificateFile: this.config.tlsCertificateFile,
    tlsCertificateKeyFile: this.config.tlsCertificateKeyFile,
    tlsCertificateKeyFilePassword: this.config.tlsCertificateKeyFilePassword,
    tlsInsecure: this.config.tlsInsecure,
    w: this.config.w,
    waitQueueTimeoutMS: this.config.waitQueueTimeoutMS,
    writeConcern: this.config.writeConcern,
    wtimeoutMS: this.config.wtimeoutMS,
    wtimeout: this.config.wtimeout,
    zlibCompressionLevel: this.config.zlibCompressionLevel,
  };

  if (this.config.host || this.config.port || this.config.user || this.config.password) {
    return cb(new Error(
      'The MongoDB connection options must be specified as a `url` parameter. Replace the use of `host`, `port`, `user` and `password` with `url`'));
  }

  const optionsDiff = _.difference(
    Object.keys(_.omit(this.config, ['wlNext', 'identity', 'url', 'database', 'schema', 'adapter', 'version'])),
    Object.keys(connectionOptions));
  if (optionsDiff.length > 0) {
    return cb(new Error(
      'The following options are no longer valid: ' + optionsDiff.join(', ') +
      '\n\nCheck the new valid configuration options in `https://mongodb.github.io/node-mongodb-native/5.0/interfaces/MongoClientOptions.html`'));
  }

  // Build A Mongo Connection String
  // Use config connection string if available

  if (!this.config.url) {
    return cb(new Error(
      'The MongoDB connection must be specified as a `url` parameter.'));
  } else {

    this.client = new MongoClient(this.config.url, connectionOptions);
    return cb(null, this.client.db(this.config.database), this.client);
  }
};

/**
 * Ensure Indexes
 *
 * @param {String} collection
 * @param {Array} indexes
 * @param {Function} callback
 * @api private
 */

Connection.prototype._createIndexes = async function _createIndexes(collection, indexes, cb) {
  try {
    const promises = indexes.map((index) => collection.createIndex(index.index, index.options));
    await Promise.all(promises);
    return cb();
  } catch (err) {
    return cb(err);
  }

};
