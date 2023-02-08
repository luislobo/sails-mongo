const assert = require('assert');
const _ = require('@sailshq/lodash');
const Query = require('../../lib/query');

describe('Query', function() {

  describe('normalize OR clause', function() {

    it('should allow OR and an array value', function() {
      const options = {
        where: {
          or: [
            {
              id: [
                '536014d4226745c20e40fcb6',
                '52aa8260bcbb564333000023',
              ],
            },
            {
              name: 'foo',
            },
          ],
        },
      };

      const Q = new Query(options, {id: {type: 'string'}});
      const criteria = Q.criteria.where;

      assert(criteria.hasOwnProperty('$or'));
      assert(criteria['$or'].length === 2);
      assert(criteria['$or'][0].hasOwnProperty('_id'));
      assert(criteria['$or'][0]._id.hasOwnProperty('$in'));
      assert(criteria['$or'][0]._id['$in'].length === 2);
      assert(criteria['$or'][1].hasOwnProperty('name'));
    });

    it('should accept `null` clause without throwing error', function () {
      const options = {
        where: {
          or: [null],
        },
      };
      const Q = new Query(options, {id: {type: 'string'}});
      const criteria = Q.criteria.where;
      assert(criteria.hasOwnProperty('$or'));
      assert(criteria['$or'].length === 1);
      assert(_.isEmpty(criteria['$or'][0]));
    });

    it('should accept `null` without throwing error', function () {
      const options = {
        where: {
          or: null,
        },
      };
      const Q = new Query(options, {id: {type: 'string'}});
      const criteria = Q.criteria.where;
      assert(criteria.hasOwnProperty('$or') === false);
    });

  });

});
