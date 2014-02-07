var ConnectionState, NSQDConnection, WriterConnectionState, WriterNSQDConnection, chai, expect, should, sinon, sinonChai, _, _ref;

_ = require('underscore');

chai = require('chai');

expect = chai.expect;

should = chai.should();

sinon = require('sinon');

sinonChai = require('sinon-chai');

chai.use(sinonChai);

_ref = require('../lib/nsqdconnection'), ConnectionState = _ref.ConnectionState, NSQDConnection = _ref.NSQDConnection, WriterNSQDConnection = _ref.WriterNSQDConnection, WriterConnectionState = _ref.WriterConnectionState;

describe('Reader ConnectionState', function() {
  var state;
  state = {
    sent: [],
    connection: null,
    statemachine: null
  };
  beforeEach(function() {
    var connection, sent, statemachine, write;
    sent = [];
    connection = new NSQDConnection('127.0.0.1', 4150, 'topic_test', 'channel_test');
    write = sinon.stub(connection, 'write', function(data) {
      return sent.push(data.toString());
    });
    statemachine = new ConnectionState(connection);
    return _.extend(state, {
      sent: sent,
      connection: connection,
      statemachine: statemachine
    });
  });
  it('handle initial handshake', function() {
    var sent, statemachine;
    statemachine = state.statemachine, sent = state.sent;
    statemachine.start();
    sent[0].should.match(/^  V2$/);
    return sent[1].should.match(/^IDENTIFY/);
  });
  it('handle OK identify response', function() {
    var connection, statemachine;
    statemachine = state.statemachine, connection = state.connection;
    statemachine.start();
    statemachine.raise('response', 'OK');
    connection.maxRdyCount.should.eq(2500);
    connection.maxMsgTimeout.should.eq(900000);
    return connection.msgTimeout.should.eq(60000);
  });
  it('handle identify response', function() {
    var connection, statemachine;
    statemachine = state.statemachine, connection = state.connection;
    statemachine.start();
    statemachine.raise('response', JSON.stringify({
      max_rdy_count: 1000,
      max_msg_timeout: 10 * 60 * 1000,
      msg_timeout: 2 * 60 * 1000
    }));
    connection.maxRdyCount.should.eq(1000);
    connection.maxMsgTimeout.should.eq(600000);
    return connection.msgTimeout.should.eq(120000);
  });
  it('create a subscription', function(done) {
    var connection, sent, statemachine;
    sent = state.sent, statemachine = state.statemachine, connection = state.connection;
    connection.on(NSQDConnection.READY, function() {
      return done();
    });
    statemachine.start();
    statemachine.raise('response', 'OK');
    sent[2].should.match(/^SUB topic_test channel_test\n$/);
    return statemachine.raise('response', 'OK');
  });
  return it('handle a message', function(done) {
    var connection, statemachine;
    statemachine = state.statemachine, connection = state.connection;
    connection.on(NSQDConnection.MESSAGE, function(msg) {
      return done();
    });
    statemachine.start();
    statemachine.raise('response', 'OK');
    statemachine.raise('response', 'OK');
    statemachine.current_state_name.should.eq('READY_RECV');
    statemachine.raise('consumeMessage', {});
    return statemachine.current_state_name.should.eq('READY_RECV');
  });
});

describe('WriterConnectionState', function() {
  var state;
  state = {
    sent: [],
    connection: null,
    statemachine: null
  };
  beforeEach(function() {
    var connection, sent, statemachine, write;
    sent = [];
    connection = new WriterNSQDConnection('127.0.0.1', 4150, 30);
    write = sinon.stub(connection, 'write', function(data) {
      return sent.push(data.toString());
    });
    statemachine = new WriterConnectionState(connection);
    connection.statemachine = statemachine;
    return _.extend(state, {
      sent: sent,
      connection: connection,
      statemachine: statemachine
    });
  });
  it('should generate a READY event after IDENTIFY', function(done) {
    var connection, statemachine;
    statemachine = state.statemachine, connection = state.connection;
    connection.on(WriterNSQDConnection.READY, function() {
      statemachine.current_state_name.should.eq('READY_SEND');
      return done();
    });
    statemachine.start();
    return statemachine.raise('response', 'OK');
  });
  it('should use PUB when sending a single message', function(done) {
    var connection, sent, statemachine;
    statemachine = state.statemachine, connection = state.connection, sent = state.sent;
    connection.on(WriterNSQDConnection.READY, function() {
      connection.produceMessages('test', ['one']);
      sent[sent.length - 1].should.match(/^PUB/);
      return done();
    });
    statemachine.start();
    return statemachine.raise('response', 'OK');
  });
  return it('should use MPUB when sending multiplie messages', function(done) {
    var connection, sent, statemachine;
    statemachine = state.statemachine, connection = state.connection, sent = state.sent;
    connection.on(WriterNSQDConnection.READY, function() {
      connection.produceMessages('test', ['one', 'two']);
      sent[sent.length - 1].should.match(/^MPUB/);
      return done();
    });
    statemachine.start();
    return statemachine.raise('response', 'OK');
  });
});
