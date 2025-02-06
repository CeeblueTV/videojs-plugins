import document from 'global/document';

import QUnit from 'qunit';
import videojs from 'video.js';
import { SourceController } from '../src/controllers/SourceController';

const SourceType = SourceController.SourceType;

QUnit.module('SourceController', {

  beforeEach() {

    // Mock the environment's timers because certain things - particularly
    // player readiness - are asynchronous in video.js 5.
    this.fixture = document.getElementById('qunit-fixture');
    this.video = document.createElement('video');
    this.fixture.appendChild(this.video);
    this.player = videojs(this.video);
  },

  afterEach() {
    this.player.dispose();
  }
});

QUnit.test('Check sourceToObject', function(assert) {
  const done = assert.async();
  let res;

  res = SourceController.sourceToObject(SourceType.LLHLS, {});
  assert.equal(res, null, 'invalid source object');

  res = SourceController.sourceToObject(SourceType.HLS, {endPoint: 'localhost', streamName: 'test'});
  assert.equal(res.type, 'application/vnd.apple.mpegurl', 'HLS mime type');
  assert.equal(res.src, 'https://localhost/hls/test/index.m3u8', 'HLS source URL');
  assert.equal(res.sourceType, SourceType.HLS, 'HLS source type');

  res = SourceController.sourceToObject(SourceType.DASH, {endPoint: 'localhost', streamName: 'test', accessToken: '1234'});
  assert.equal(res.type, 'application/dash+xml', 'DASH mime type');
  assert.equal(res.src, 'https://localhost/cmaf/test/index.mpd?id=1234', 'DASH source URL with access token');
  assert.equal(res.sourceType, SourceType.DASH, 'DASH source type');

  res = SourceController.sourceToObject(SourceType.WEBRTC, {endPoint: 'localhost', streamName: 'test'});
  assert.equal(res.type, undefined, 'WEBRTC mime type');
  assert.equal(res.src, 'wss://localhost/webrtc/test', 'WEBRTC source URL');
  assert.equal(res.sourceType, SourceType.WEBRTC, 'WEBRTC source type');
  assert.equal(res.iceserver.urls[0], 'turn:localhost:3478?transport=tcp', 'WEBRTC ice server 1');
  assert.equal(res.iceserver.urls[1], 'turn:localhost:3478', 'WEBRTC ice server 2');
  assert.equal(res.iceserver.username, 'ceeblue', 'WEBRTC ice servers username');
  assert.equal(res.iceserver.credential, 'ceeblue', 'WEBRTC ice servers credential');

  done();
});

QUnit.test('Try an empty config', function(assert) {
  const done = assert.async();

  try {
    const sourceController = new SourceController(this.player, {}, []);

    assert.ok(!sourceController, 'should not be able to create a source controller with an empty config');
  } catch (exception) {
    assert.equal(exception.message, 'SourceController sources must not be empty', 'not able to set an empty source');
    done();
  }
});

QUnit.test('Try to play from unknown server', function(assert) {
  assert.timeout(20000);
  const done = assert.async();

  const sourceController = new SourceController(this.player, {endPoint: 'unknown', streamName: 'test'}, [SourceType.WEBRTC, SourceType.LLHLS, SourceType.DASH, SourceType.HLS]);

  sourceController.on('sourcechanged', (source) => {
    this.dataMessages = '';
    if (source === null) {
      assert.ok(sourceController.started === false, 'sourcechanged(null) event triggered on player');
      done();
    } else {
      assert.ok(false, 'sourcechanged with source, should not happen');
    }
  });
  sourceController.start();
});
