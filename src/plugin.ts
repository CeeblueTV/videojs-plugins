/**
 * A Video.js plugin.
 *
 * This file contains :
 * - the Ceeblue WebRTC source handler
 * - the QualityButton plugin
 */

import videojs from 'video.js';
import WebRTCSourceHandler from './sources/webrtcSourceHandler';
import { CeeblueVideoJSPlugin } from './ceeblue';
import 'videojs-contrib-quality-levels';

// Register the Ceeblue plugin
videojs.registerPlugin('ceeblue', CeeblueVideoJSPlugin);

// register source handlers with the appropriate techs
// @ts-expect-error - registerSourceHandler is always defined
videojs.getTech('Html5')?.registerSourceHandler?.(WebRTCSourceHandler, 0);

videojs.log('ceeblue/videojs-plugins ' + WebRTCSourceHandler.VERSION + ' loaded');

export default CeeblueVideoJSPlugin;
export {type CeeblueCloudSource, type CeeblueSingleSource, type CeeblueSource, type CeeblueSources, type CeeblueURLSource } from './sources/sources';
