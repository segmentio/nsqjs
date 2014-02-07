var LOOKUPD_1, LOOKUPD_2, NSQD_1, NSQD_2, chai, expect, lookup, nock, registerWithLookupd, setFailedTopicReply, should, sinon, sinonChai, _;

_ = require('underscore');

chai = require('chai');

expect = chai.expect;

nock = require('nock');

should = chai.should();

sinon = require('sinon');

sinonChai = require('sinon-chai');

chai.use(sinonChai);

lookup = require('../lib/lookupd');

NSQD_1 = {
  address: 'localhost',
  broadcast_address: 'localhost',
  hostname: 'localhost',
  http_port: 4151,
  remote_address: 'localhost:12345',
  tcp_port: 4150,
  topics: ['sample_topic'],
  version: '0.2.23'
};

NSQD_2 = {
  address: 'localhost',
  broadcast_address: 'localhost',
  hostname: 'localhost',
  http_port: 5151,
  remote_address: 'localhost:56789',
  tcp_port: 5150,
  topics: ['sample_topic'],
  version: '0.2.23'
};

LOOKUPD_1 = '127.0.0.1:4161';

LOOKUPD_2 = '127.0.0.1:5161';

registerWithLookupd = function(lookupdAddress, nsqd) {
  var producers, topic, _i, _len, _ref, _results;
  producers = nsqd != null ? [nsqd] : [];
  if (nsqd != null) {
    _ref = nsqd.topics;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      topic = _ref[_i];
      _results.push(nock("http://" + lookupdAddress).get("/lookup?topic=" + topic).reply(200, {
        status_code: 200,
        status_txt: 'OK',
        data: {
          producers: producers
        }
      }));
    }
    return _results;
  }
};

setFailedTopicReply = function(lookupdAddress, topic) {
  return nock("http://" + lookupdAddress).get("/lookup?topic=" + topic).reply(200, {
    status_code: 500,
    status_txt: 'INVALID_ARG_TOPIC',
    data: null
  });
};

describe('lookupd.lookup', function() {
  afterEach(function() {
    return nock.cleanAll();
  });
  describe('querying a single lookupd for a topic', function() {
    it('should return an empty list if no nsqd nodes', function(done) {
      setFailedTopicReply(LOOKUPD_1, 'sample_topic');
      return lookup(LOOKUPD_1, 'sample_topic', function(err, nodes) {
        nodes.should.be.empty;
        return done();
      });
    });
    return it('should return a list of nsqd nodes for a success reply', function(done) {
      registerWithLookupd(LOOKUPD_1, NSQD_1);
      return lookup(LOOKUPD_1, 'sample_topic', function(err, nodes) {
        var key, _i, _len, _ref;
        nodes.should.have.length(1);
        _ref = ['address', 'broadcast_address', 'tcp_port', 'http_port'];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          key = _ref[_i];
          _.keys(nodes[0]).should.contain(key);
        }
        return done();
      });
    });
  });
  return describe('querying a multiple lookupd', function() {
    it('should combine results from multiple lookupds', function(done) {
      var lookupdAddresses;
      registerWithLookupd(LOOKUPD_1, NSQD_1);
      registerWithLookupd(LOOKUPD_2, NSQD_2);
      lookupdAddresses = [LOOKUPD_1, LOOKUPD_2];
      return lookup(lookupdAddresses, 'sample_topic', function(err, nodes) {
        nodes.should.have.length(2);
        _.chain(nodes).pluck('tcp_port').sort().value().should.be.eql([4150, 5150]);
        return done();
      });
    });
    it('should dedupe combined results', function(done) {
      var lookupdAddresses;
      registerWithLookupd(LOOKUPD_1, NSQD_1);
      registerWithLookupd(LOOKUPD_2, NSQD_1);
      lookupdAddresses = [LOOKUPD_1, LOOKUPD_2];
      return lookup(lookupdAddresses, 'sample_topic', function(err, nodes) {
        nodes.should.have.length(1);
        return done();
      });
    });
    return it('should succeed inspite of failures to query a lookupd', function(done) {
      var lookupdAddresses;
      registerWithLookupd(LOOKUPD_1, NSQD_1);
      nock("http://" + LOOKUPD_2).get('/lookup?topic=sample_topic').reply(500);
      lookupdAddresses = [LOOKUPD_1, LOOKUPD_2];
      return lookup(lookupdAddresses, 'sample_topic', function(err, nodes) {
        nodes.should.have.length(1);
        return done();
      });
    });
  });
});
