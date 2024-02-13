import document from 'global/document';

import QUnit from 'qunit';
import videojs from 'video.js';

QUnit.module('WebRTCSource', {

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

QUnit.test('Try an empty WebRTC src source', function(assert) {
  const done = assert.async();

  this.player.on('error', function() {
    assert.ok(true, 'error event triggered on player');
    done();
  });
  this.player.src({});
});
