/**
 * A Video.js plugin.
 *
 * This file contains :
 * - the Ceeblue WebRTC source handler
 * - the QualityButton plugin
 */

import videojs from 'video.js';
import { VERSION as WEBRTC_VERSION } from '@ceeblue/webrtc-client';
import { VERSION as WRTS_VERSION } from '@ceeblue/wrts-client';
import SourceHandler from './sources/sourceHandler';
import { CeeblueVideoJSPlugin } from './ceeblue';
import { QualityButtonPlugin } from './qualityButton';
import './registerQualityLevels';

// Register the Ceeblue plugin
videojs.registerPlugin('ceeblue', CeeblueVideoJSPlugin);
videojs.registerPlugin('qualityButton', QualityButtonPlugin);

// register source handlers with the appropriate techs
// @ts-expect-error - registerSourceHandler is always defined
videojs.getTech('Html5')?.registerSourceHandler?.(SourceHandler, 0);

videojs.log('ceeblue/videojs-plugins ' + SourceHandler.VERSION + ' loaded (WebRTC client version ' + WEBRTC_VERSION + ', WRTS client version ' + WRTS_VERSION + ')');

export default CeeblueVideoJSPlugin;
export { QualityButtonPlugin };
export {type CeeblueCloudSource, type CeeblueSingleSource, type CeeblueSource, type CeeblueSources, type CeeblueURLSource } from './sources/sources';
