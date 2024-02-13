import document from 'global/document';

import QUnit from 'qunit';
import sinon from 'sinon';
import videojs from 'video.js';

const Player = videojs.getComponent('Player');

QUnit.module('qualityButton', {

  beforeEach() {

    // Mock the environment's timers because certain things - particularly
    // player readiness - are asynchronous in video.js 5.
    this.clock = sinon.useFakeTimers();
    this.fixture = document.getElementById('qunit-fixture');
    this.video = document.createElement('video');
    this.fixture.appendChild(this.video);
    this.player = videojs(this.video);
  },

  afterEach() {
    this.player.dispose();
    this.clock.restore();
  }
});

QUnit.test('registers itself with video.js', function(assert) {
  assert.expect(1);

  assert.strictEqual(
    typeof Player.prototype.qualityButton,
    'function',
    'qualityButton plugin was registered'
  );

  // initialize the plugin
  this.player.qualityButton();
  // tick forward enough to ready the player
  this.clock.tick(1);
});
