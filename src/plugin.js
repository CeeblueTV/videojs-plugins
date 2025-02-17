/**
 * A Video.js plugin.
 *
 * This file contains :
 * - the Ceeblue WebRTC source handler
 * - the QualityButton plugin
 */

import * as webrtcClient from '@ceeblue/webrtc-client';
import { SourceController } from './controllers/SourceController';
import { setupQualityButton } from './components/QualityMenuButton';
import { WebRTCSource } from './sources/WebRTCSource';
import videojs from 'video.js';

// will be replaced on building by library version
const __libVersion__ = '?';

/**
 * The Videojs WebRTC source handler.
 */
const WebRTCSourceHandler = {
  name: 'ceeblue/videojs-plugins',
  VERSION: __libVersion__,
  // expose 'webrtc-client' classes
  webrtcClient,

  canHandleSource(srcObj, options = {}) {
    const localOptions = videojs.obj.merge(videojs.options, options);

    localOptions.source = srcObj.src;

    return WebRTCSourceHandler.canPlayType(srcObj.type, localOptions);
  },
  handleSource(source, tech, options = {}) {
    const localOptions = videojs.obj.merge(videojs.options, options);

    // setting the src already dispose the component, no need to dispose it again
    tech.webrtc = new WebRTCSource(source, tech, localOptions);

    return tech.webrtc;
  },

  canPlayType(type, options = {}) {
    if (type) {
      // To prevent starting to play HTTP based streams
      return '';
    }
    const mediaUrl = options.source;

    try {
      const url = new URL(mediaUrl);

      // Is this a websocket or http url?
      if (url.protocol !== 'ws:' && url.protocol !== 'wss:' &&
          url.protocol !== 'http:' && url.protocol !== 'https:') {
        return '';
      }
      // Does the websocket url have the correct "webrtc" application name?
      const application = url.pathname.split('/')[1];

      if (application !== 'webrtc') {
        // it is not expected but we can try to connect anyway
        return 'maybe';
      }
    } catch (e) {
      return '';
    }

    return 'probably';
  }
};

// register source handlers with the appropriate techs
videojs.getTech('Html5').registerSourceHandler(WebRTCSourceHandler, 0);

/**
 * The quality button plugin.
 *
 * @param {Object} options Plugin options object
 * @return {boolean} the button if added, undefined otherwise
 */
const qualityButton = function(options) {
  return setupQualityButton(this, videojs.obj.merge({}, options));
};

// Register the plugins with video.js.
videojs.registerPlugin('qualityButton', qualityButton);
videojs.registerPlugin('sourceController', SourceController);

videojs.log('ceeblue/videojs-plugins ' + WebRTCSourceHandler.VERSION + ' loaded');

export default
{
  WebRTCSourceHandler,
  qualityButton,
  SourceController
};
