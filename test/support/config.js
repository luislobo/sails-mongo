module.exports = {
  url: `mongodb://${process.env.MONGO_PORT_27017_TCP_ADDR || process.env.WATERLINE_ADAPTER_TESTS_HOST || 'localhost'}:${process.env.WATERLINE_ADAPTER_TESTS_PORT || 27017}/${process.env.WATERLINE_ADAPTER_TESTS_DATABASE || 'sails-mongo'}`,
  database: process.env.WATERLINE_ADAPTER_TESTS_DATABASE || 'sails-mongo'
};
