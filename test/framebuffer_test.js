var FrameBuffer, chai, createFrame, expect, should, sinon, sinonChai, wire;

chai = require('chai');

expect = chai.expect;

should = chai.should();

sinon = require('sinon');

sinonChai = require('sinon-chai');

chai.use(sinonChai);

FrameBuffer = require('../lib/framebuffer');

wire = require('../lib/wire');

createFrame = function(frameId, payload) {
  var frame;
  frame = new Buffer(4 + 4 + payload.length);
  frame.writeInt32BE(payload.length + 4, 0);
  frame.writeInt32BE(frameId, 4);
  frame.write(payload, 8);
  return frame;
};

describe('FrameBuffer', function() {
  it('should parse a single, full frame', function() {
    var data, frameBuffer, frameId, frames, payload, _ref;
    frameBuffer = new FrameBuffer();
    data = createFrame(wire.FRAME_TYPE_RESPONSE, 'OK');
    frames = frameBuffer.consume(data);
    _ref = frames.pop(), frameId = _ref[0], payload = _ref[1];
    frameId.should.eq(wire.FRAME_TYPE_RESPONSE);
    return payload.toString().should.eq('OK');
  });
  it('should parse two full frames', function() {
    var data, firstFrame, frameBuffer, frameId, frames, secondFrame, _ref, _ref1;
    frameBuffer = new FrameBuffer();
    firstFrame = createFrame(wire.FRAME_TYPE_RESPONSE, 'OK');
    secondFrame = createFrame(wire.FRAME_TYPE_ERROR, JSON.stringify({
      shortname: 'localhost'
    }));
    frames = frameBuffer.consume(Buffer.concat([firstFrame, secondFrame]));
    frames.length.should.eq(2);
    _ref = frames.shift(), frameId = _ref[0], data = _ref[1];
    frameId.should.eq(wire.FRAME_TYPE_RESPONSE);
    data.toString().should.eq('OK');
    _ref1 = frames.shift(), frameId = _ref1[0], data = _ref1[1];
    frameId.should.eq(wire.FRAME_TYPE_ERROR);
    return data.toString().should.eq(JSON.stringify({
      shortname: 'localhost'
    }));
  });
  it('should parse frame delivered in partials', function() {
    var data, frameBuffer, frames;
    frameBuffer = new FrameBuffer();
    data = createFrame(wire.FRAME_TYPE_RESPONSE, 'OK');
    frames = frameBuffer.consume(data.slice(0, 3));
    frames.length.should.eq(0);
    frames = frameBuffer.consume(data.slice(3, 8));
    frames.length.should.eq(0);
    frames = frameBuffer.consume(data.slice(8));
    return frames.length.should.eq(1);
  });
  it('should parse multiple frames delivered in partials', function() {
    var data, first, frameBuffer, frames, second;
    frameBuffer = new FrameBuffer();
    first = createFrame(wire.FRAME_TYPE_RESPONSE, 'OK');
    second = createFrame(wire.FRAME_TYPE_RESPONSE, '{}');
    data = Buffer.concat([first, second]);
    frames = frameBuffer.consume(data.slice(0, 3));
    frames.length.should.eq(0);
    frames = frameBuffer.consume(data.slice(3, 8));
    frames.length.should.eq(0);
    frames = frameBuffer.consume(data.slice(8, 12));
    frames.length.should.eq(1);
    frames = frameBuffer.consume(data.slice(12));
    return frames.length.should.eq(1);
  });
  return it('empty internal buffer when all frames are consumed', function() {
    var data, frame, frameBuffer;
    frameBuffer = new FrameBuffer();
    data = createFrame(wire.FRAME_TYPE_RESPONSE, 'OK');
    frame = frameBuffer.consume(data);
    return expect(frameBuffer.buffer).to.be["null"];
  });
});
