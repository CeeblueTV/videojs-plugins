/**
 * A Video.js plugin.
 *
 * This file contains :
 * - the Ceeblue WebRTC source handler
 * - the QualityButton plugin
 */

import videojs from 'video.js';
import { VERSION } from '@ceeblue/webrtc-client';
import WebRTCSourceHandler from './sources/webrtcSourceHandler';
import { CeeblueVideoJSPlugin } from './ceeblue';
import { QualityButtonPlugin } from './qualityButton';
import './registerQualityLevels';

// Register the Ceeblue plugin
videojs.registerPlugin('ceeblue', CeeblueVideoJSPlugin);
videojs.registerPlugin('qualityButton', QualityButtonPlugin);

// register source handlers with the appropriate techs
// @ts-expect-error - registerSourceHandler is always defined
videojs.getTech('Html5')?.registerSourceHandler?.(WebRTCSourceHandler, 0);

videojs.log('ceeblue/videojs-plugins ' + WebRTCSourceHandler.VERSION + ' loaded (WebRTC client version ' + VERSION + ')');

export default CeeblueVideoJSPlugin;
export { QualityButtonPlugin };
export {type CeeblueCloudSource, type CeeblueSingleSource, type CeeblueSource, type CeeblueSources, type CeeblueURLSource } from './sources/sources';
