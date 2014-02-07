var RoundRobinList, assert, should, _;

_ = require('underscore');

assert = require('assert');

should = require('chai').should();

RoundRobinList = require('../lib/roundrobinlist');

describe('roundrobinlist', function() {
  var lst, rrl;
  lst = null;
  rrl = null;
  beforeEach(function() {
    lst = [1, 2, 3];
    return rrl = new RoundRobinList(lst);
  });
  describe('constructor', function() {
    it('should have @lst eq to passed in list', function() {
      return assert(_.isEqual(rrl.lst, lst));
    });
    it('should have made a copy of the list argument', function() {
      return assert(rrl.lst !== lst);
    });
    return it('should have @index eq to 0', function() {
      return rrl.index.should.eq(0);
    });
  });
  describe('add', function() {
    return it('@lst should include the item', function() {
      rrl.add(10);
      return rrl.lst.should.contain(10);
    });
  });
  describe('next', function() {
    it('should return a list of 1 item by default', function() {
      assert(_.isEqual(rrl.next(), lst.slice(0, 1)));
      return rrl.index.should.eq(1);
    });
    it('should return a list as large as the count provided', function() {
      assert(_.isEqual(rrl.next(2), lst.slice(0, 2)));
      return rrl.index.should.eq(2);
    });
    return it('should return all items and and then start over', function() {
      assert(_.isEqual(rrl.next(), [1]));
      assert(_.isEqual(rrl.next(), [2]));
      assert(_.isEqual(rrl.next(), [3]));
      return assert(_.isEqual(rrl.next(), [1]));
    });
  });
  return describe('remove', function() {
    it('should remove the item if it exists in the list', function() {
      rrl.remove(3);
      return rrl.lst.should.not.contain(3);
    });
    it('should not affect the order of items returned', function() {
      rrl.remove(1);
      assert(_.isEqual(rrl.next(), [2]));
      assert(_.isEqual(rrl.next(), [3]));
      return assert(_.isEqual(rrl.next(), [2]));
    });
    it('should not affect the order of items returned with items consumed', function() {
      assert(_.isEqual(rrl.next(), [1]));
      assert(_.isEqual(rrl.next(), [2]));
      rrl.remove(2);
      assert(_.isEqual(rrl.next(), [3]));
      return assert(_.isEqual(rrl.next(), [1]));
    });
    return it('should silently fail when it does not have the item', function() {
      rrl.remove(10);
      assert(_.isEqual(rrl.lst, [1, 2, 3]));
      return rrl.index.should.eq(0);
    });
  });
});
