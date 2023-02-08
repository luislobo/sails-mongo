const assert = require('assert');
const _ = require('@sailshq/lodash');
const ObjectID = require('mongodb').ObjectId;
const Query = require('../../../lib/query');

describe('Query', function () {
  'use strict';

  describe('against Waterline Query Language (addition cases)', function () {

    describe('with Normal Pair', function () {

      it('should query as null if the value is null', function () {
        const options = {
          where: {
            name: null,
          },
        };
        const Q = new Query(options, {name: 'string'});
        const criteria = Q.criteria.where;
        assert(criteria.hasOwnProperty('name'));
        assert(criteria['name'] === null);
      });

    });

    describe('when like is null', function () {

      it('should consider like as a normal attribute', function () {
        const options = {
          where: {
            name: {like: null},
          },
        };
        const Q = new Query(options, {name: 'string'});
        const criteria = Q.criteria.where;
        assert(criteria.hasOwnProperty('name'));
        assert(criteria['name'].hasOwnProperty('like'));
        assert(criteria['name']['like'] === null);
      });

    });

    describe('with like clause', function () {

      it('should be ignored if it is null', function () {
        const options = {
          where: {
            like: null,
          },
        };
        const Q = new Query(options, {name: 'string'});
        const criteria = Q.criteria.where;
        assert(criteria.hasOwnProperty('like') === false);
      });

      it('should consider as a normal object if it is NOT a top level operator', function () {
        const where = {
          name: {
            like: {
              name: '%a',
              title: 'b%',
            },
          },
        };
        const expect = _.cloneDeep(where);
        const Q = new Query({where: where}, {name: 'string', title: 'string'});
        const actual = Q.criteria.where;
        assert(_.isEqual(actual, expect));
      });

    });

    it('should accept NOT expression, not only NOT Pair', function () {
      const where = {
        age: {'!': {'>': 0, '<': 100}},
      };
      let expect;
      expect = {
        age: { $not: { $gt: 0, $lt: 100 } }
      };
      const Q = new Query({where: where}, {age: 'integer'});
      const actual = Q.criteria.where;
      assert(_.isEqual(actual, expect));
    });

    describe('with objectid values', function () {

      it('should accept objectid in Equal Pair', function () {
        const _id = new ObjectID();
        const where = {
          user: new ObjectID(_id),
        };
        const expect = {
          user: new ObjectID(_id),
        };
        const Q = new Query({where: where}, {user: 'objectid'});
        const actual = Q.criteria.where;
        assert(_.isEqual(actual['user'].toString(), expect['user'].toString()));
      });

      it('should accept objectid string', function () {
        const _id = new ObjectID();
        const where = {
          user: '' + new ObjectID(_id),
        };

        const Q = new Query({where: where}, {user: 'objectid'});
        const actual = Q.criteria.where;
        assert(_.isEqual(typeof actual['user'], 'string'));
      });

      it('should accept objectid in Not Pair', function () {
        const _id = new ObjectID();
        const where = {
          user: {'!': new ObjectID(_id)},
        };
        const expect = {
          user: {$ne: new ObjectID(_id)},
        };
        const Q = new Query({where: where}, {user: 'objectid'});
        const actual = Q.criteria.where;
        assert(_.isEqual(actual['user']['$ne'].toString(), expect['user']['$ne'].toString()));
      });

      it('should accept objectid in In Pair', function () {
        const _ids = [new ObjectID(), new ObjectID()];
        const where = {
          user: [new ObjectID(_ids[0]), new ObjectID(_ids[1])],
        };
        const expect = {
          user: {$in: [new ObjectID(_ids[0]), new ObjectID(_ids[1])]},
        };
        const Q = new Query({where: where}, {user: 'objectid'});
        const actual = Q.criteria.where;
        assert(_.isEqual(actual['user']['$in'][0].toString(), expect['user']['$in'][0].toString()));
        assert(_.isEqual(actual['user']['$in'][1].toString(), expect['user']['$in'][1].toString()));
      });

      it('should accept objectid in Object Pair', function () {
        const _id = new ObjectID();
        const where = {
          user: {'>': new ObjectID(_id)},
        };
        const expect = {
          user: {$gt: new ObjectID(_id)},
        };
        const Q = new Query({where: where}, {user: 'objectid'});
        const actual = Q.criteria.where;
        assert(_.isEqual(actual['user']['$gt'].toString(), expect['user']['$gt'].toString()));
        assert(_.isEqual(actual['user']['$gt'].toString(), expect['user']['$gt'].toString()));
      });

    });

    describe('with `in` clause', function () {

      it('should parse as `$in` clause', function () {
        const id1 = new ObjectID();
        const id2 = new ObjectID();
        const id3 = new ObjectID();
        const where = {
          id: [id1.toString(), id2.toString(), id3.toString()],
        };
        let expect;
        expect = {
          _id: { $in: [id1, id2, id3] }
        };
        const Q = new Query({where: where},
          {id: {type: 'objectid', primaryKey: true}});
        const actual = Q.criteria.where;
        assert(_.isEqual(actual, expect));
      });

    });

    describe('with `not in` clause', function () {

      it('should parse as `$nin` clause', function () {
        const id1 = new ObjectID();
        const id2 = new ObjectID();
        const id3 = new ObjectID();
        const where = {
          id: {'!': [id1.toString(), id2.toString(), id3.toString()]},
        };
        let expect;
        expect = {
          _id: { $nin: [id1, id2, id3] }
        };
        const Q = new Query({where: where},
          {id: {type: 'objectid', primaryKey: true}});
        const actual = Q.criteria.where;
        assert(_.isEqual(actual, expect));
      });

    });

  });


  describe('against native MongoDB query criteria', function () {

    it('should accept `$exists` selector', function () {
      const where = {name: {$exists: true}};
      const expect = _.cloneDeep(where);
      const Q = new Query({where: where}, {name: 'string'});
      const actual = Q.criteria.where;
      assert(_.isEqual(actual, expect));
    });

    it('should accept `$near` selector', function () {
      const where = {};
      where.location = {
        $near: {
          $geometry   : { type: 'Point', coordinates: [ 40 , 5 ] },
          $maxDistance: 500
        }
      };
      const expect = _.cloneDeep(where);
      const Q = new Query({where: where}, {location: 'json'});
      const actual = Q.criteria.where;
      assert(_.isEqual(actual, expect));
    });

    it('should accept `$ne` selector without turning string value to a RegExp', function () {
      const where = {name: {$ne: 'a'}};
      const expect = _.cloneDeep(where);
      const Q = new Query({where: where}, {name: 'string'});
      const actual = Q.criteria.where;
      assert(_.isEqual(actual, expect));
    });

    it('should accept `$gt` selector without turning string value to a RegExp', function () {
      const where = {name: {$gt: 'banana'}};
      const expect = _.cloneDeep(where);
      const Q = new Query({where: where}, {name: 'string'});
      const actual = Q.criteria.where;
      assert(_.isEqual(actual, expect));
    });

    it('should accept `$gte` selector without turning string value to a RegExp', function () {
      const where = {name: {$gte: 'apple'}};
      const expect = _.cloneDeep(where);
      const Q = new Query({where: where}, {name: 'string'});
      const actual = Q.criteria.where;
      assert(_.isEqual(actual, expect));
    });

  });


  describe('against hybrid criteria', function () {

    it('should accept Waterline Query Pair and MongoDB Query Pair together', function () {
      const where = {
        name: {$exists: false},
        age: {'>': 1},
      };
      const expect = {name: {$exists: false}, age: {$gt: 1}};
      const Q = new Query({where: where}, {name: 'string', age: 'integer'});
      const actual = Q.criteria.where;
      assert(_.isEqual(actual, expect));
    });

    it('should accept MongoDB Query Pair within Waterline OR clause', function () {
      const where = {
        or: [{name: {$exists: false}}, {name: {'!': 'clark'}}],
      };
      const expect = {$or: [{name: {$exists: false}}, {name: {$ne: 'clark'}}]};
      const Q = new Query({where: where}, {name: 'string', age: 'integer'});
      const actual = Q.criteria.where;
      assert(_.isEqual(actual, expect));
    });

  });

});
