var ConnectionRdy, EventEmitter, Message, NSQDConnection, ReaderRdy, StateChangeLogger, StubNSQDConnection, chai, connRdyEntries, createNSQDConnection, expect, rdyAlternates, should, sinon, sinonChai, _, _ref,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

_ = require('underscore');

chai = require('chai');

expect = chai.expect;

should = chai.should;

sinon = require('sinon');

sinonChai = require('sinon-chai');

chai.use(sinonChai);

EventEmitter = require('events').EventEmitter;

NSQDConnection = require('../lib/nsqdconnection').NSQDConnection;

Message = require('../lib/message');

_ref = require('../lib/readerrdy'), ReaderRdy = _ref.ReaderRdy, ConnectionRdy = _ref.ConnectionRdy;

StateChangeLogger = require('../lib/logging');

StubNSQDConnection = (function(_super) {
  __extends(StubNSQDConnection, _super);

  function StubNSQDConnection(nsqdHost, nsqdPort, topic, channel, requeueDelay, heartbeatInterval) {
    this.nsqdHost = nsqdHost;
    this.nsqdPort = nsqdPort;
    this.topic = topic;
    this.channel = channel;
    this.requeueDelay = requeueDelay;
    this.heartbeatInterval = heartbeatInterval;
    this.conn = {
      localPort: 1
    };
    this.maxRdyCount = 2500;
    this.msgTimeout = 60 * 1000;
    this.maxMsgTimeout = 15 * 60 * 1000;
  }

  StubNSQDConnection.prototype.connect = function() {};

  StubNSQDConnection.prototype.setRdy = function(rdyCount) {};

  StubNSQDConnection.prototype.createMessage = function(msgId, msgTimestamp, attempts, msgBody) {
    var msg, msgArgs, msgComponents,
      _this = this;
    msgComponents = [msgId, msgTimestamp, attempts, msgBody];
    msgArgs = msgComponents.concat([this.requeueDelay, this.msgTimeout, this.maxMsgTimeout]);
    msg = (function(func, args, ctor) {
      ctor.prototype = func.prototype;
      var child = new ctor, result = func.apply(child, args);
      return Object(result) === result ? result : child;
    })(Message, msgArgs, function(){});
    msg.on(Message.RESPOND, function(responseType, wireData) {
      if (responseType === Message.FINISH) {
        StateChangeLogger.log('NSQDConnection', null, _this.conn.localPort, 'msg finished');
        return _this.emit(NSQDConnection.FINISHED);
      } else if (responseType === Message.REQUEUE) {
        StateChangeLogger.log('NSQDConnection', null, _this.conn.localPort, 'msg requeued');
        return _this.emit(NSQDConnection.REQUEUED);
      }
    });
    msg.on(Message.BACKOFF, function() {
      return _this.emit(NSQDConnection.BACKOFF);
    });
    StateChangeLogger.log('NSQDConnection', 'READY_RECV', '1', "message (" + msgId + ")");
    this.emit(NSQDConnection.MESSAGE, msg);
    return msg;
  };

  return StubNSQDConnection;

})(EventEmitter);

createNSQDConnection = function(id) {
  var conn;
  conn = new StubNSQDConnection('localhost', '4151', 'test', 'default', 60, 30);
  conn.conn.localPort = id;
  return conn;
};

describe('ConnectionRdy', function() {
  var cRdy, conn, spy, _ref1;
  _ref1 = [null, null, null], conn = _ref1[0], spy = _ref1[1], cRdy = _ref1[2];
  beforeEach(function() {
    conn = createNSQDConnection(1);
    spy = sinon.spy(conn, 'setRdy');
    cRdy = new ConnectionRdy(conn);
    return cRdy.start();
  });
  it('should register listeners on a connection', function() {
    var mock;
    conn = new NSQDConnection('localhost', 1234, 'test', 'test');
    mock = sinon.mock(conn);
    mock.expects('on').withArgs(NSQDConnection.ERROR);
    mock.expects('on').withArgs(NSQDConnection.FINISHED);
    mock.expects('on').withArgs(NSQDConnection.MESSAGE);
    mock.expects('on').withArgs(NSQDConnection.REQUEUED);
    mock.expects('on').withArgs(NSQDConnection.READY);
    cRdy = new ConnectionRdy(conn);
    return mock.verify();
  });
  it('should have a connection RDY max of zero', function() {
    return expect(cRdy.maxConnRdy).is.eql(0);
  });
  it('should not increase RDY when connection RDY max has not been set', function() {
    cRdy.bump();
    expect(cRdy.maxConnRdy).is.eql(0);
    return expect(spy.called).is.not.ok;
  });
  it('should not allow RDY counts to be negative', function() {
    cRdy.setConnectionRdyMax(10);
    cRdy.setRdy(-1);
    return expect(spy.notCalled).is.ok;
  });
  it('should not allow RDY counts to exceed the connection max', function() {
    cRdy.setConnectionRdyMax(10);
    cRdy.setRdy(9);
    cRdy.setRdy(10);
    cRdy.setRdy(20);
    expect(spy.calledTwice).is.ok;
    expect(spy.firstCall.args[0]).is.eql(9);
    return expect(spy.secondCall.args[0]).is.eql(10);
  });
  it('should set RDY to max after initial bump', function() {
    cRdy.setConnectionRdyMax(3);
    cRdy.bump();
    return expect(spy.firstCall.args[0]).is.eql(3);
  });
  it('should keep RDY at max after 1+ bumps', function() {
    var i, _i, _j, _ref2, _results;
    cRdy.setConnectionRdyMax(3);
    for (i = _i = 1; _i <= 3; i = ++_i) {
      cRdy.bump();
    }
    expect(cRdy.maxConnRdy).is.eql(3);
    _results = [];
    for (i = _j = 0, _ref2 = spy.callCount; 0 <= _ref2 ? _j < _ref2 : _j > _ref2; i = 0 <= _ref2 ? ++_j : --_j) {
      _results.push(expect(spy.getCall(i).args[0]).is.at.most(3));
    }
    return _results;
  });
  it('should set RDY to zero from after first bump and then backoff', function() {
    cRdy.setConnectionRdyMax(3);
    cRdy.bump();
    cRdy.backoff();
    return expect(spy.lastCall.args[0]).is.eql(0);
  });
  it('should set RDY to zero after 1+ bumps and then a backoff', function() {
    cRdy.setConnectionRdyMax(3);
    cRdy.bump();
    cRdy.backoff();
    return expect(spy.lastCall.args[0]).is.eql(0);
  });
  it('should raise RDY when new connection RDY max is lower', function() {
    cRdy.setConnectionRdyMax(3);
    cRdy.bump();
    cRdy.setConnectionRdyMax(5);
    expect(cRdy.maxConnRdy).is.eql(5);
    return expect(spy.lastCall.args[0]).is.eql(5);
  });
  it('should reduce RDY when new connection RDY max is higher', function() {
    cRdy.setConnectionRdyMax(3);
    cRdy.bump();
    cRdy.setConnectionRdyMax(2);
    expect(cRdy.maxConnRdy).is.eql(2);
    return expect(spy.lastCall.args[0]).is.eql(2);
  });
  return it('should update RDY when 75% of previous RDY is consumed', function() {
    var i, msg, _i;
    cRdy.setConnectionRdyMax(10);
    cRdy.bump();
    expect(spy.firstCall.args[0]).is.eql(10);
    for (i = _i = 1; _i <= 7; i = ++_i) {
      msg = conn.createMessage("" + i, Date.now(), 0, "Message " + i);
      msg.finish();
      cRdy.bump();
    }
    expect(spy.callCount).is.eql(1);
    msg = conn.createMessage('8', Date.now(), 0, 'Message 8');
    msg.finish();
    cRdy.bump();
    expect(spy.callCount).is.eql(2);
    return expect(spy.lastCall.args[0]).is.eql(10);
  });
});

/*
Helper functions for dealing with StateChangeLogger entries.
*/


/*
Returns log entries for the ConnectionRdy state that reflect the updated
RDY count. The RDY count is parsed out and added as an object property.
*/


connRdyEntries = function() {
  return _.chain(StateChangeLogger.logs).where({
    'component': 'ConnectionRdy'
  }).filter(function(entry) {
    return /RDY \d+/.test(entry.message);
  }).map(function(entry) {
    var rdy;
    rdy = Number(/RDY (\d+)/.exec(entry.message)[1]);
    return _.extend({}, entry, {
      rdy: rdy
    });
  }).map(function(entry) {
    return _.pick(entry, ['id', 'rdy']);
  }).value();
};

/*
In low RDY situations, the RDY count should alternate between 0 and 1 as
each connections loses and gains the shared RDY count via the periodic
balance call.
*/


rdyAlternates = function(entries) {
  var evens, evensMatch, i, odds, oddsMatch;
  entries = entries.length % 2 === 0 ? entries : entries.slice(0, -1);
  evens = (function() {
    var _i, _ref1, _results;
    _results = [];
    for (i = _i = 0, _ref1 = entries.length; _i < _ref1; i = _i += 2) {
      _results.push(entries[i]);
    }
    return _results;
  })();
  odds = (function() {
    var _i, _ref1, _results;
    _results = [];
    for (i = _i = 0, _ref1 = entries.length - 1; _i < _ref1; i = _i += 2) {
      _results.push(entries[i + 1]);
    }
    return _results;
  })();
  evensMatch = _.all(evens, function(entry) {
    return entry.rdy === evens[0].rdy;
  });
  oddsMatch = _.all(odds, function(entry) {
    return entry.rdy === odds[0].rdy;
  });
  if (!(evensMatch && oddsMatch)) {
    return false;
  }
  return evens[0].rdy !== odds[0].rdy;
};

describe('ReaderRdy', function() {
  var readerRdy;
  readerRdy = null;
  beforeEach(function() {
    readerRdy = new ReaderRdy(1, 128);
    StateChangeLogger.storeLogs = true;
    StateChangeLogger.debug = false;
    return StateChangeLogger.logs = [];
  });
  afterEach(function() {
    return readerRdy.close();
  });
  it('should register listeners on a connection', function() {
    var conn, mock;
    sinon.stub(readerRdy, 'createConnectionRdy', function() {
      return {
        on: function() {}
      };
    });
    conn = createNSQDConnection(1);
    mock = sinon.mock(conn);
    mock.expects('on').withArgs(NSQDConnection.CLOSED);
    mock.expects('on').withArgs(NSQDConnection.FINISHED);
    mock.expects('on').withArgs(NSQDConnection.REQUEUED);
    mock.expects('on').withArgs(NSQDConnection.BACKOFF);
    readerRdy.addConnection(conn);
    return mock.verify();
  });
  it('should be in the zero state until a new connection is READY', function() {
    var conn;
    conn = createNSQDConnection(1);
    expect(readerRdy.current_state_name).is.eql('ZERO');
    readerRdy.addConnection(conn);
    expect(readerRdy.current_state_name).is.eql('ZERO');
    conn.emit(NSQDConnection.READY);
    return expect(readerRdy.current_state_name).is.eql('MAX');
  });
  it('should be in the zero state if it loses all connections', function() {
    var conn;
    conn = createNSQDConnection(1);
    readerRdy.addConnection(conn);
    conn.emit(NSQDConnection.READY);
    conn.emit(NSQDConnection.CLOSED);
    return expect(readerRdy.current_state_name).is.eql('ZERO');
  });
  it('should evenly distribute RDY count across connections', function() {
    var conn1, conn2, setRdyStub1, setRdyStub2;
    readerRdy = new ReaderRdy(100, 128);
    conn1 = createNSQDConnection(1);
    conn2 = createNSQDConnection(2);
    setRdyStub1 = sinon.spy(conn1, 'setRdy');
    setRdyStub2 = sinon.spy(conn2, 'setRdy');
    readerRdy.addConnection(conn1);
    conn1.emit(NSQDConnection.READY);
    expect(setRdyStub1.lastCall.args[0]).is.eql(100);
    readerRdy.addConnection(conn2);
    conn2.emit(NSQDConnection.READY);
    expect(setRdyStub1.lastCall.args[0]).is.eql(50);
    return expect(setRdyStub2.lastCall.args[0]).is.eql(50);
  });
  describe('low RDY conditions', function() {
    it('should periodically redistribute RDY', function(done) {
      var checkRdyCounts, conn, connections, i, _i, _len;
      StateChangeLogger.debug = false;
      readerRdy = new ReaderRdy(1, 128, 0.01);
      connections = (function() {
        var _i, _results;
        _results = [];
        for (i = _i = 1; _i <= 2; i = ++_i) {
          _results.push(createNSQDConnection(i));
        }
        return _results;
      })();
      for (_i = 0, _len = connections.length; _i < _len; _i++) {
        conn = connections[_i];
        readerRdy.addConnection(conn);
        conn.emit(NSQDConnection.READY);
      }
      expect(readerRdy.isLowRdy()).is.eql(true);
      checkRdyCounts = function() {
        var entries;
        entries = connRdyEntries();
        expect(rdyAlternates(entries)).should.be.ok;
        return done();
      };
      return setTimeout(checkRdyCounts, 50);
    });
    it('should handle the transition from normal', function(done) {
      var addConnection, checkRdyCounts, conn1, conn2;
      StateChangeLogger.debug = false;
      readerRdy = new ReaderRdy(1, 128, 0.01);
      conn1 = createNSQDConnection(1);
      conn2 = createNSQDConnection(2);
      readerRdy.addConnection(conn1);
      conn1.emit(NSQDConnection.READY);
      expect(readerRdy.isLowRdy()).is.eql(false);
      addConnection = function() {
        readerRdy.addConnection(conn2);
        conn2.emit(NSQDConnection.READY);
        return expect(readerRdy.isLowRdy()).is.eql(true);
      };
      setTimeout(addConnection, 20);
      checkRdyCounts = function() {
        var entries;
        entries = connRdyEntries();
        expect(rdyAlternates(entries)).should.be.ok;
        return done();
      };
      return setTimeout(checkRdyCounts, 40);
    });
    it('should handle the transition to normal conditions', function(done) {
      var checkNormal, conn, connections, i, removeConnection, _i, _len;
      StateChangeLogger.debug = false;
      readerRdy = new ReaderRdy(1, 128, 0.01);
      connections = (function() {
        var _i, _results;
        _results = [];
        for (i = _i = 1; _i <= 2; i = ++_i) {
          _results.push(createNSQDConnection(i));
        }
        return _results;
      })();
      for (_i = 0, _len = connections.length; _i < _len; _i++) {
        conn = connections[_i];
        readerRdy.addConnection(conn);
        conn.emit(NSQDConnection.READY);
      }
      expect(readerRdy.isLowRdy()).is.eql(true);
      removeConnection = function() {
        StateChangeLogger.log('NSQDConnection', 'CLOSED', '2', 'connection closed');
        connections[1].emit(NSQDConnection.CLOSED);
        return setTimeout(checkNormal, 20);
      };
      checkNormal = function() {
        expect(readerRdy.isLowRdy()).is.eql(false);
        expect(readerRdy.balanceId).is["null"];
        expect(readerRdy.connections[0].lastRdySent).is.eql(1);
        return done();
      };
      return setTimeout(removeConnection, 20);
    });
    it('should move to normal conditions with connections in backoff', function(done) {
      /*
      1. Create two nsqd connections
      2. Close the 2nd connection when the first connection is in the BACKOFF
          state.
      3. Check to see if the 1st connection does get it's RDY count.
      */

      var checkNormal, conn, connections, i, removeConnection, removeOnBackoff, _i, _len;
      StateChangeLogger.debug = false;
      readerRdy = new ReaderRdy(1, 128, 0.01);
      connections = (function() {
        var _i, _results;
        _results = [];
        for (i = _i = 1; _i <= 2; i = ++_i) {
          _results.push(createNSQDConnection(i));
        }
        return _results;
      })();
      for (_i = 0, _len = connections.length; _i < _len; _i++) {
        conn = connections[_i];
        readerRdy.addConnection(conn);
        conn.emit(NSQDConnection.READY);
      }
      expect(readerRdy.isLowRdy()).is.eql(true);
      removeConnection = _.once(function() {
        StateChangeLogger.log('NSQDConnection', 'CLOSED', '2', 'connection closed');
        connections[1].emit(NSQDConnection.CLOSED);
        return setTimeout(checkNormal, 30);
      });
      removeOnBackoff = function() {
        var connRdy1;
        connRdy1 = readerRdy.connections[0];
        return connRdy1.on(ConnectionRdy.STATE_CHANGE, function() {
          if (connRdy1.statemachine.current_state_name === 'BACKOFF') {
            return setTimeout(removeConnection, 0);
          }
        });
      };
      checkNormal = function() {
        expect(readerRdy.isLowRdy()).is.eql(false);
        expect(readerRdy.balanceId).is["null"];
        expect(readerRdy.connections[0].lastRdySent).is.eql(1);
        return done();
      };
      return setTimeout(removeOnBackoff, 20);
    });
    it('should not exceed maxInFlight for long running message.', function(done) {
      var checkRdyCount, conn, connections, handleMessage, i, sendMessageOnce, sendOnRdy, _i, _j, _len, _len1;
      StateChangeLogger.debug = false;
      readerRdy = new ReaderRdy(1, 128, 0.01);
      connections = (function() {
        var _i, _results;
        _results = [];
        for (i = _i = 1; _i <= 2; i = ++_i) {
          _results.push(createNSQDConnection(i));
        }
        return _results;
      })();
      for (_i = 0, _len = connections.length; _i < _len; _i++) {
        conn = connections[_i];
        readerRdy.addConnection(conn);
        conn.emit(NSQDConnection.READY);
      }
      handleMessage = function(msg) {
        var finish;
        finish = function() {
          msg.finish();
          return done();
        };
        return setTimeout(finish, 40);
      };
      for (_j = 0, _len1 = connections.length; _j < _len1; _j++) {
        conn = connections[_j];
        conn.on(NSQDConnection.MESSAGE, handleMessage);
      }
      sendMessageOnce = _.once(function() {
        connections[1].createMessage('1', Date.now(), new Buffer('test'));
        return setTimeout(checkRdyCount, 20);
      });
      sendOnRdy = function() {
        var connRdy2;
        connRdy2 = readerRdy.connections[1];
        return connRdy2.on(ConnectionRdy.STATE_CHANGE, function() {
          var _ref1;
          if ((_ref1 = connRdy2.statemachine.current_state_name) === 'ONE' || _ref1 === 'MAX') {
            return sendMessageOnce();
          }
        });
      };
      checkRdyCount = function() {
        expect(readerRdy.isLowRdy()).is.eql(true);
        expect(readerRdy.connections[0].lastRdySent).is.eql(0);
        return expect(readerRdy.connections[1].lastRdySent).is.eql(0);
      };
      return setTimeout(sendOnRdy, 20);
    });
    return it('should recover losing a connection with a message in-flight', function(done) {
      /*
      Detailed description:
      1. Connect to 5 nsqds and add them to the ReaderRdy
      2. When the 1st connection has the shared RDY count, it receives a
         message.
      3. On receipt of a message, the 1st connection will process the message
         for a long period of time.
      4. While the message is being processed, the 1st connection will close.
      5. Finally, check that the other connections are indeed now getting the
         RDY count.
      */

      var checkRdyCount, closeConnection, conn, connections, handleMessage, i, sendMessageOnce, sendOnRdy, _i, _j, _len, _len1;
      StateChangeLogger.debug = false;
      readerRdy = new ReaderRdy(1, 128, 0.01);
      connections = (function() {
        var _i, _results;
        _results = [];
        for (i = _i = 1; _i <= 5; i = ++_i) {
          _results.push(createNSQDConnection(i));
        }
        return _results;
      })();
      for (_i = 0, _len = connections.length; _i < _len; _i++) {
        conn = connections[_i];
        readerRdy.addConnection(conn);
        conn.emit(NSQDConnection.READY);
      }
      handleMessage = function(msg) {
        var delayFinish;
        delayFinish = function() {
          msg.finish();
          return done();
        };
        setTimeout(closeConnection, 10);
        setTimeout(checkRdyCount, 30);
        return setTimeout(delayFinish, 50);
      };
      for (_j = 0, _len1 = connections.length; _j < _len1; _j++) {
        conn = connections[_j];
        conn.on(NSQDConnection.MESSAGE, handleMessage);
      }
      closeConnection = _.once(function() {
        return connections[0].emit(NSQDConnection.CLOSED);
      });
      sendMessageOnce = _.once(function() {
        return connections[0].createMessage('1', Date.now(), new Buffer('test'));
      });
      sendOnRdy = function() {
        var connRdy;
        connRdy = readerRdy.connections[0];
        return connRdy.on(ConnectionRdy.STATE_CHANGE, function() {
          var _ref1;
          if ((_ref1 = connRdy.statemachine.current_state_name) === 'ONE' || _ref1 === 'MAX') {
            return sendMessageOnce();
          }
        });
      };
      checkRdyCount = function() {
        var connRdy, rdyCounts;
        expect(readerRdy.isLowRdy()).is.eql(true);
        rdyCounts = (function() {
          var _k, _len2, _ref1, _results;
          _ref1 = readerRdy.connections;
          _results = [];
          for (_k = 0, _len2 = _ref1.length; _k < _len2; _k++) {
            connRdy = _ref1[_k];
            _results.push(connRdy.lastRdySent);
          }
          return _results;
        })();
        expect(readerRdy.connections.length).is.eql(4);
        return expect(__indexOf.call(rdyCounts, 1) >= 0).is.ok;
      };
      return setTimeout(sendOnRdy, 10);
    });
  });
  return describe('try', function() {
    it('should on completion of backoff attempt a single connection', function(done) {
      /*
      Detailed description:
      1. Create ReaderRdy with connections to 5 nsqds.
      2. Generate a message from an nsqd that causes a backoff.
      3. Verify that all the nsqds are in backoff mode.
      4. At the end of the backoff period, verify that only one ConnectionRdy
         is in the try one state and the others are still in backoff.
      */

      var afterBackoff, checkInBackoff, conn, connections, delay, i, msg, _i, _len;
      StateChangeLogger.debug = false;
      readerRdy = new ReaderRdy(100, 10, 0.01);
      connections = (function() {
        var _i, _results;
        _results = [];
        for (i = _i = 1; _i <= 5; i = ++_i) {
          _results.push(createNSQDConnection(i));
        }
        return _results;
      })();
      for (_i = 0, _len = connections.length; _i < _len; _i++) {
        conn = connections[_i];
        readerRdy.addConnection(conn);
        conn.emit(NSQDConnection.READY);
      }
      msg = connections[0].createMessage("1", Date.now(), 0, 'Message causing a backoff');
      msg.requeue();
      checkInBackoff = function() {
        var connRdy, _j, _len1, _ref1, _results;
        _ref1 = readerRdy.connections;
        _results = [];
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          connRdy = _ref1[_j];
          _results.push(expect(connRdy.statemachine.current_state_name).is.eql('BACKOFF'));
        }
        return _results;
      };
      setTimeout(checkInBackoff, 0);
      afterBackoff = function() {
        var backoffs, connRdy, ones, s, states;
        states = (function() {
          var _j, _len1, _ref1, _results;
          _ref1 = readerRdy.connections;
          _results = [];
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            connRdy = _ref1[_j];
            _results.push(connRdy.statemachine.current_state_name);
          }
          return _results;
        })();
        ones = (function() {
          var _j, _len1, _results;
          _results = [];
          for (_j = 0, _len1 = states.length; _j < _len1; _j++) {
            s = states[_j];
            if (s === 'ONE') {
              _results.push(s);
            }
          }
          return _results;
        })();
        backoffs = (function() {
          var _j, _len1, _results;
          _results = [];
          for (_j = 0, _len1 = states.length; _j < _len1; _j++) {
            s = states[_j];
            if (s === 'BACKOFF') {
              _results.push(s);
            }
          }
          return _results;
        })();
        expect(ones).to.have.length(1);
        expect(backoffs).to.have.length(4);
        return done();
      };
      delay = readerRdy.backoffTimer.getInterval().plus(0.05);
      return setTimeout(afterBackoff, new Number(delay.valueOf()) * 1000);
    });
    return it('should after backoff with a successful message go to MAX', function(done) {
      /*
      Detailed description:
      1. Create ReaderRdy with connections to 5 nsqds.
      2. Generate a message from an nsqd that causes a backoff.
      3. At the end of backoff, generate a message that will succeed.
      4. Verify that ReaderRdy is in MAX and ConnectionRdy instances are in
         either ONE or MAX. At least on ConnectionRdy should be in MAX as well.
      */

      var afterBackoff, conn, connections, delay, i, msg, _i, _len;
      StateChangeLogger.debug = false;
      readerRdy = new ReaderRdy(100, 1, 0.01);
      connections = (function() {
        var _i, _results;
        _results = [];
        for (i = _i = 1; _i <= 5; i = ++_i) {
          _results.push(createNSQDConnection(i));
        }
        return _results;
      })();
      for (_i = 0, _len = connections.length; _i < _len; _i++) {
        conn = connections[_i];
        readerRdy.addConnection(conn);
        conn.emit(NSQDConnection.READY);
      }
      msg = connections[0].createMessage("1", Date.now(), 0, 'Message causing a backoff');
      msg.requeue();
      afterBackoff = function() {
        var connRdy, verifyMax;
        connRdy = (function() {
          var _j, _len1, _ref1, _results;
          _ref1 = readerRdy.connections;
          _results = [];
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            connRdy = _ref1[_j];
            if (connRdy.statemachine.current_state_name === 'ONE') {
              _results.push(connRdy);
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        })()[0];
        msg = connRdy.conn.createMessage("1", Date.now(), 0, 'Success');
        msg.finish();
        verifyMax = function() {
          var max, s, states;
          states = (function() {
            var _j, _len1, _ref1, _results;
            _ref1 = readerRdy.connections;
            _results = [];
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              connRdy = _ref1[_j];
              _results.push(connRdy.statemachine.current_state_name);
            }
            return _results;
          })();
          max = (function() {
            var _j, _len1, _results;
            _results = [];
            for (_j = 0, _len1 = states.length; _j < _len1; _j++) {
              s = states[_j];
              if (s === 'ONE' || s === 'MAX') {
                _results.push(s);
              }
            }
            return _results;
          })();
          expect(max).to.have.length(5);
          expect(states).to.contain('MAX');
          return done();
        };
        return setTimeout(verifyMax, 0);
      };
      delay = readerRdy.backoffTimer.getInterval() + 100;
      return setTimeout(afterBackoff, delay * 1000);
    });
  });
});
