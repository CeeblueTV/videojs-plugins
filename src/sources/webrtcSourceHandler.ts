import videojs from 'video.js';
import { WebRTCSource } from './WebRTCSource';
import type Tech from 'video.js/dist/types/tech/tech';
import { ceeblueSignalingMimeType, determineSourceTypeFromURL, type VideojsSourceObject, type VideojsWebRTCSourceObject } from './sources';

// Replaced with the plugin's version during the build process.
const __libVersion__ = '?';

/**
 * Ceeblue WebRTC source handler.
 */
const WebRTCSourceHandler = {
  name: 'ceeblue/videojs-plugins',
  VERSION: __libVersion__,
  canHandleSource(srcObj: VideojsSourceObject) {
    let type: string | void = srcObj.type;

    if (!type) {
      type = determineSourceTypeFromURL(srcObj.src)?.type;
    }

    return WebRTCSourceHandler.canPlayType(type);
  },
  handleSource(source: VideojsWebRTCSourceObject, tech: Tech, options: Record<string, unknown> = {}) {
    const localOptions = videojs.obj.merge(videojs.options, options);
    const webrtcSource = new WebRTCSource(source, tech, localOptions);

    // @ts-expect-error - webrtc is not defined on Tech.
    tech.webrtc = webrtcSource;

    return webrtcSource;
  },
  canPlayType(type: string | void) {
    // If the type is not defined we try to handle it, anyway!
    // This is to keep compatibility with the previous version of the plugin.
    // When the source is provided through player.src() method!
    if (!type) {
      return 'maybe';
    }

    switch (type) {
    case ceeblueSignalingMimeType:
    case 'application/sdp':
      return 'probably';
    default:
      return '';
    }
  }
};

export default WebRTCSourceHandler;
