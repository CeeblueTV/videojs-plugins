export const protocols = ['webrtc', 'llhls', 'hls', 'dash'] as const;

type protocol = typeof protocols[number];

/**
 * Ceeblue Cloud HLS source settings.
 */
export type CeeblueCloudHLSSettings = {
  /**
   * HLS format.
   *
   * @default 'cmaf'
   */
  format?: 'cmaf' | 'ts';
}

/**
 * WebRTC Source settings.
 */
export type CeeblueWebRTCSettings = {
  /**
   * signaling server protocol, ceeblue-ws for ceeblue websocket based signaling protocol.
   *
   * @default 'ceeblue-ws'
   */
  signaling?: 'ceeblue-ws' | 'whip';
  /**
   * ICE server configuration.
   */
  iceServers?: RTCIceServer[];
}

/**
 * Ceeblue video sources settings.
 */
type CeeblueSourcesSettings = {
  webrtc?: CeeblueWebRTCSettings;
  hls?: CeeblueCloudHLSSettings;
};

/**
 * Ceeblue Cloud source types.
 */
export type CeeblueCloudSource = {
  /**
   * Ceeblue Cloud endpoint.
   */
  endPoint: string;
  /**
   * Ceeblue Cloud stream name.
   */
  streamName: string;
  /**
   * Ceeblue Cloud access token (optional).
   */
  accessToken?: string;
  /**
   * The list of protocols to use.
   * Protocol priority is determined by the order of the protocols in the array.
   *
   * @default ['webrtc', 'llhls', 'hls', 'dash']
   */
  protocols?: protocol[];
  /**
   * Custom URL query parameters.
   */
  query?: URLSearchParams;
  settings?: CeeblueSourcesSettings;
}

/**
 * Direct URL source.
 * SourceController will try to determine the source type using the URL.
 */
export type CeeblueAutoURLSource = {
  url: string;
  mimeType?: string;
}

/**
 * HLS, LLHLS, DASH URL-based source.
 */
export type CeeblueHTTPURLSource = {
  url: string;
  type: 'hls' | 'llhls' | 'dash';
}

/**
 * WebRTC URL-based source.
 */
export type CeeblueWebRTCURLSource = {
  url: string;
  type: 'webrtc';
} & CeeblueWebRTCSettings;

/**
 * SourceController Direct URL source.
 */
export type CeeblueURLSource = CeeblueAutoURLSource | CeeblueHTTPURLSource | CeeblueWebRTCURLSource;

/**
 * General SourceController settings.
 */
export type CeeblueSettings = {
  autoRetry?: true;
  autoFallback?: true;
}

/**
 * SourceController source type.
 */
export type CeeblueSource = CeeblueCloudSource | CeeblueURLSource;

/**
 * SourceController options for a single source.
 */
export type CeeblueSingleSource = CeeblueSettings & CeeblueSource;

/**
 * SourceController options for multiple sources.
 */
export type CeeblueSources = CeeblueSettings & {
  /**
   * The global settings for all sources.
   * If a source has its own settings, It will get merged with these settings.
   * Source settings have higher priority.
   */
  settings?: CeeblueSourcesSettings;
  sources: CeeblueSource[];
}

export type VideojsHTTPSourceObject = {
  src: string;
  type?: string;
  sourceType?: Exclude<protocol, 'webrtc'>;
}

// Ceeblue Cloud signaling MIME type for WebRTC over websocket.
export const ceeblueSignalingMimeType = 'application/x-ceeblue-webrtc-signaling';

export type VideojsWebRTCSourceObject = {
  src: string;
  type?: 'application/sdp' | typeof ceeblueSignalingMimeType;
  sourceType: 'webrtc';
  iceServers?: RTCIceServer[];
  audiobutton?: boolean | string;
  data?: boolean | string;
}

/**
 * Repesents a Videojs source object.
 */
export type VideojsSourceObject = VideojsHTTPSourceObject | VideojsWebRTCSourceObject;

/**
 * Ceeblue sources options.
 */
export type CeeblueSourcesOptions = CeeblueSingleSource | CeeblueSources;

/**
 * Expand Ceeblue plugin options to Videojs sources.
 */
export function expandSourcesToVideoJSSources(option: CeeblueSourcesOptions) {
  return getOptionSources(option).map(expandSourceToURLSource).flat();
}

type CeeblueDeterminedSourceType = {
  type: 'application/sdp';
  sourceType: 'webrtc';
} | {
  type: typeof ceeblueSignalingMimeType;
  sourceType: 'webrtc';
} | {
  type: 'application/vnd.apple.mpegurl';
  sourceType: 'hls' | 'llhls';
} | {
  type: 'application/dash+xml';
  sourceType: 'dash';
};

/**
 * Determine the source type and mime type from just Ceeblue source.
 * This is based on how we build and handle media URLs at Ceeblue.
 */
export function determineSourceTypeFromURL(src: string): CeeblueDeterminedSourceType | void {
  try {
    const url = new URL(src);

    if (!/^(http|ws)s?:/.test(url.protocol)) {
      return void 0;
    }

    if (url.protocol.startsWith('ws')) {
      return {
        type: ceeblueSignalingMimeType,
        sourceType: 'webrtc'
      };
    }

    const application = url.pathname.split('/')[1];

    if (application === 'webrtc') {
      return {
        type: 'application/sdp',
        sourceType: 'webrtc'
      };
    }

    const index = url.pathname.split('/').pop();

    if (index === 'index.m3u8') {
      const format = url.pathname.split('/')[0];

      if (format === 'cmaf') {
        return {
          type: 'application/vnd.apple.mpegurl',
          sourceType: 'llhls'
        };
      }

      return {
        type: 'application/vnd.apple.mpegurl',
        sourceType: 'hls'
      };
    }

    if (index === 'index.mpd') {
      return {
        type: 'application/dash+xml',
        sourceType: 'dash'
      };
    }
  } catch {
    return void 0;
  }

  return void 0;
}

function getOptionSources(option: CeeblueSourcesOptions): CeeblueSource[] {
  if (isSourceControllerSingleSource(option)) {
    return [option];
  }

  return option.sources;
}

function expandSourceToURLSource(source: CeeblueSource): VideojsSourceObject|VideojsSourceObject[] {
  if (isSourceControllerURLSource(source)) {
    const urlSource: VideojsSourceObject = {
      src: source.url
    };
    const mimeType = (source as CeeblueAutoURLSource).mimeType;
    const type = (source as CeeblueHTTPURLSource).type;

    if (mimeType) {
      urlSource.type = mimeType;
    }

    if (type) {
      urlSource.sourceType = type;
    }

    return urlSource;
  }

  if (!isSourceControllerCloudSource(source)) {
    throw new Error(`Unknown source type expected URL source or Cloud source ${JSON.stringify(source)}`);
  }

  return buildCloudSource(source);
}

function buildCloudSource(source: CeeblueCloudSource): VideojsSourceObject[] {
  const usedProtocols = source.protocols?.length ? source.protocols : protocols;
  const sources: VideojsSourceObject[] = [];

  for (const proto of usedProtocols) {
    if (!protocols.includes(proto)) {
      throw new Error(`Unknown protocol ${proto}`);
    }

    if (proto === 'webrtc') {
      sources.push(buildWebRTCSource(source));

      continue
    }

    let urlPorotocol = '';
    let format = '';
    let index = '';
    let type = '';

    switch (proto) {
    case 'hls':
      urlPorotocol = 'https';
      format = 'cmaf';
      index = 'index.m3u8';
      type = 'application/vnd.apple.mpegurl';
      break;
    case 'llhls':
      urlPorotocol = 'https';
      format = 'cmaf';
      index = 'index.m3u8';
      type = 'application/vnd.apple.mpegurl';
      break;
    case 'dash':
      urlPorotocol = 'https';
      format = 'cmaf';
      index = 'index.mpd';
      type = 'application/dash+xml';
      break;
    }

    let url = `${urlPorotocol}://${source.endPoint}/${format}/${source.streamName}`;

    if (index) {
      url += `/${index}`;
    }

    const query = source.query || new URLSearchParams();

    if (source.accessToken) {
      query.set('id', source.accessToken);
    }

    url += `?${query.toString()}`;

    sources.push({
      src: url,
      type,
      sourceType: proto
    });
  }

  return sources;
}

function buildWebRTCSource(source: CeeblueCloudSource): VideojsWebRTCSourceObject {
  let proto = 'wss';
  let mimeType: VideojsWebRTCSourceObject['type'] = ceeblueSignalingMimeType;

  if (source.settings?.webrtc?.signaling === 'whip') {
    proto = 'https';
    mimeType = 'application/sdp';
  }

  const sourceObject: VideojsWebRTCSourceObject = {
    src: `${proto}://${source.endPoint}/webrtc/${source.streamName}`,
    sourceType: 'webrtc',
    type: mimeType
  };

  if (source.settings?.webrtc?.iceServers) {
    sourceObject.iceServers = source.settings.webrtc.iceServers;
  }

  return sourceObject;
}

function isSourceControllerSingleSource(option: CeeblueSourcesOptions): option is CeeblueSingleSource {
  return !Array.isArray(option as CeeblueSources);
}

function isSourceControllerURLSource(source: CeeblueSource): source is CeeblueURLSource {
  return 'url' in source;
}

function isSourceControllerCloudSource(source: CeeblueSource): source is CeeblueCloudSource {
  return 'endPoint' in source && 'streamName' in source;
}
