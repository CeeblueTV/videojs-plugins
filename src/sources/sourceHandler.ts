import videojs from 'video.js';
import { WebRTCSource } from './WebRTCSource';
import { WRTSSource } from './WRTSSource';
import type Tech from 'video.js/dist/types/tech/tech';
import { ceeblueSignalingMimeType, determineSourceTypeFromURL, type VideojsSourceObject, type VideojsWebRTCSourceObject, type VideojsWRTSSourceObject } from './sources';

// Replaced with the plugin's version during the build process.
const __libVersion__ = '?';

/**
 * Ceeblue source handler.
 */
const SourceHandler = {
  name: 'ceeblue/videojs-plugins',
  VERSION: __libVersion__,
  canHandleSource(srcObj: VideojsSourceObject) {
    let type: string | void = srcObj.type;

    if (!type || !srcObj.sourceType) {
      const determined = determineSourceTypeFromURL(srcObj.src);

      type = determined?.type;
      if (determined?.sourceType) {
        srcObj.sourceType = determined.sourceType;
      }
    }

    if (srcObj.sourceType === 'wrts') {
      return 'probably';
    }

    return SourceHandler.canPlayType(type);
  },
  handleSource(source: VideojsWebRTCSourceObject | VideojsWRTSSourceObject, tech: Tech, options: Record<string, unknown> = {}) {
    const localOptions = videojs.obj.merge(videojs.options, options);

    if (source.sourceType === 'wrts') {
      const wrtsSource = new WRTSSource(source, tech, localOptions);

      // @ts-expect-error - wrts is not defined on Tech.
      tech.wrts = wrtsSource;

      return wrtsSource;
    }

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
    case 'application/json':
      return 'probably';
    default:
      return '';
    }
  }
};

export default SourceHandler;
