import QUnit from 'qunit';
import sinon from 'sinon';
import videojs from 'video.js';

import plugin from '../src/plugin.js';

// Test integrity of the plugin
QUnit.test('the environment is sane', function(assert) {
  assert.strictEqual(typeof Array.isArray, 'function', 'es5 exists');
  assert.strictEqual(typeof sinon, 'object', 'sinon exists');
  assert.strictEqual(typeof videojs, 'function', 'videojs exists');
  assert.strictEqual(typeof plugin, 'object', 'plugin is an object');
  assert.strictEqual(typeof plugin.WebRTCSourceHandler, 'object', 'WebRTCSourceHandler is an object');
  assert.strictEqual(typeof plugin.qualityButton, 'function', 'qualityButton is a function');
  assert.strictEqual(typeof plugin.SourceController, 'function', 'SourceController is a function');
});
