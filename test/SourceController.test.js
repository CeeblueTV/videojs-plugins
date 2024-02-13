import document from 'global/document';

import QUnit from 'qunit';
import videojs from 'video.js';
import { SourceController } from '../src/controllers/SourceController';

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

QUnit.test('Try an empty config', function(assert) {
  const done = assert.async();

  const sourceController = new SourceController(this.player);

  sourceController.on('sourcechanged', (source) => {
    this.dataMessages = '';
    if (source === null) {
      assert.ok(sourceController.started === false, 'sourcechanged(null) event triggered on player');
      done();
    }
  });
  sourceController.start({}, []);
});
