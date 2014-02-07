var BackoffTimer, decimal, should;

should = require('chai').should();

decimal = require('bignumber.js');

BackoffTimer = require('../lib/backofftimer');

describe('backofftimer', function() {
  var timer;
  timer = null;
  beforeEach(function() {
    return timer = new BackoffTimer(0, 128);
  });
  describe('constructor', function() {
    it('should have @maxShortTimer eq 1', function() {
      return timer.maxShortTimer.toString().should.equal('32');
    });
    it('should have a @maxLongTimer eq 3', function() {
      return timer.maxLongTimer.toString().should.equal('96');
    });
    it('should have a @shortUnit equal to 0.1', function() {
      return timer.shortUnit.toString().should.equal('3.2');
    });
    return it('should have a @longUnit equal to 0.3', function() {
      return timer.longUnit.toString().should.equal('0.384');
    });
  });
  describe('success', function() {
    it('should adjust @shortInterval to 0', function() {
      timer.success();
      return timer.shortInterval.toString().should.equal('0');
    });
    return it('should adjust @longInterval to 0', function() {
      timer.success();
      return timer.longInterval.toString().should.equal('0');
    });
  });
  describe('failure', function() {
    it('should adjust @shortInterval to 3.2 after 1 failure', function() {
      timer.failure();
      return timer.shortInterval.toString().should.equal('3.2');
    });
    return it('should adjust @longInterval to .384 after 1 failure', function() {
      timer.failure();
      return timer.longInterval.toString().should.equal('0.384');
    });
  });
  return describe('getInterval', function() {
    it('should initially be 0', function() {
      return timer.getInterval().toString().should.equal('0');
    });
    it('should be 0 after 1 success', function() {
      timer.success();
      return timer.getInterval().toString().should.equal('0');
    });
    it('should be 0 after 2 successes', function() {
      timer.success();
      timer.success();
      return timer.getInterval().toString().should.equal('0');
    });
    it('should be 3.584 after 1 failure', function() {
      timer.failure();
      return timer.getInterval().toString().should.equal('3.584');
    });
    return it('should be 7.168 after 2 failure', function() {
      timer.failure();
      timer.failure();
      return timer.getInterval().toString().should.equal('7.168');
    });
  });
});
