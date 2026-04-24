import type { CMCD, CMCDMode } from '@ceeblue/wrts-client';

/**
 * Protocols list supported by Ceeblue sources.
 * The order determines the priority of the protocols.
 */
export const protocols = ['wrts', 'webrtc', 'llhls', 'hls', 'dash'] as const;

type protocol = typeof protocols[number];

export type CeeblueDRMKeySystemConfiguration = {
  licenseUri?: string;
  certificateUri?: string;
  [key: string]: unknown;
};

export type CeeblueDRMKeySystems = Record<string, string | CeeblueDRMKeySystemConfiguration>;

type CeeblueHTTPDRMSettings = {
  /**
   * DRM configuration passed through to Video.js HTTP sources.
   */
  keySystems?: CeeblueDRMKeySystems;
};

/**
 * Ceeblue Cloud HLS source settings.
 */
export type CeeblueCloudHLSSettings = CeeblueHTTPDRMSettings & {
  /**
   * HLS format.
   *
   * @default 'cmaf'
   */
  format?: 'cmaf' | 'ts';
}

/**
 * Ceeblue Cloud DASH source settings.
 */
export type CeeblueCloudDASHSettings = CeeblueHTTPDRMSettings;

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

export type CeeblueWRTSCMCD = CMCD;
export type CeeblueWRTSCMCDMode = CMCDMode;

/**
 * WebRTS source settings.
 */
export type CeeblueWRTSSettings = {
  /**
   * Low buffer threshold in milliseconds.
   */
  bufferLimitLow?: number;
  /**
   * High buffer threshold in milliseconds.
   */
  bufferLimitHigh?: number;
  /**
   * Reliable playback disables adaptive frame-skipping.
   */
  reliable?: boolean;
  /**
   * CMCD verbosity.
   */
  cmcd?: CeeblueWRTSCMCD;
  /**
   * CMCD delivery mode.
   */
  cmcdMode?: CeeblueWRTSCMCDMode;
  /**
   * CMCD session identifier.
   */
  cmcdSid?: string;
}

/**
 * Ceeblue video sources settings.
 */
export type CeeblueSourcesSettings = {
  webrtc?: CeeblueWebRTCSettings;
  wrts?: CeeblueWRTSSettings;
  hls?: CeeblueCloudHLSSettings;
  dash?: CeeblueCloudDASHSettings;
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
   * @default ['wrts', 'webrtc', 'llhls', 'hls', 'dash']
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
} & CeeblueHTTPDRMSettings;

/**
 * WebRTC URL-based source.
 */
export type CeeblueWebRTCURLSource = {
  url: string;
  type: 'webrtc';
} & CeeblueWebRTCSettings;

/**
 * WebRTS URL-based source.
 */
export type CeeblueWRTSURLSource = {
  url: string;
  type: 'wrts';
} & CeeblueWRTSSettings;

/**
 * SourceController Direct URL source.
 */
export type CeeblueURLSource = CeeblueAutoURLSource | CeeblueHTTPURLSource | CeeblueWebRTCURLSource | CeeblueWRTSURLSource;

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
  sourceType?: Exclude<protocol, 'webrtc' | 'wrts'>;
  keySystems?: CeeblueDRMKeySystems;
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

export type VideojsWRTSSourceObject = {
  src: string;
  type?: 'application/json';
  sourceType: 'wrts';
  bufferLimitLow?: number;
  bufferLimitHigh?: number;
  reliable?: boolean;
  cmcd?: CeeblueWRTSCMCD;
  cmcdMode?: CeeblueWRTSCMCDMode;
  cmcdSid?: string;
}

/**
 * Repesents a Videojs source object.
 */
export type VideojsSourceObject = VideojsHTTPSourceObject | VideojsWebRTCSourceObject | VideojsWRTSSourceObject;

/**
 * Ceeblue sources options.
 */
export type CeeblueSourcesOptions = CeeblueSingleSource | CeeblueSources;

/**
 * Expand Ceeblue plugin options to Videojs sources.
 */
export function expandSourcesToVideoJSSources(option: CeeblueSourcesOptions) {
  const globalSettings = isSourceControllerSingleSource(option) ? undefined : option.settings;

  return getOptionSources(option)
    .map(source => mergeSourceWithGlobalSettings(source, globalSettings))
    .map(expandSourceToURLSource)
    .flat();
}

type CeeblueDeterminedSourceType = {
  type: 'application/sdp';
  sourceType: 'webrtc';
} | {
  type: typeof ceeblueSignalingMimeType;
  sourceType: 'webrtc';
} | {
  type: 'application/json';
  sourceType: 'wrts';
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
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (!/^(http|ws)s?:/.test(url.protocol)) {
      return void 0;
    }

    if (url.protocol.startsWith('ws')) {
      return {
        type: ceeblueSignalingMimeType,
        sourceType: 'webrtc'
      };
    }

    const application = pathParts[0];

    if (application === 'webrtc') {
      return {
        type: 'application/sdp',
        sourceType: 'webrtc'
      };
    }

    if (application === 'wrts' && pathParts[pathParts.length - 1] === 'index.json') {
      return {
        type: 'application/json',
        sourceType: 'wrts'
      };
    }

    const index = pathParts[pathParts.length - 1];

    if (index === 'index.m3u8') {
      const format = pathParts[0];

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
    const urlSource: {
      src: string;
      type?: string;
      sourceType?: protocol;
      keySystems?: CeeblueDRMKeySystems;
      bufferLimitLow?: number;
      bufferLimitHigh?: number;
      reliable?: boolean;
      cmcd?: CeeblueWRTSCMCD;
      cmcdMode?: CeeblueWRTSCMCDMode;
      cmcdSid?: string;
    } = {
      src: source.url
    };
    const mimeType = (source as CeeblueAutoURLSource).mimeType;

    if (mimeType) {
      urlSource.type = mimeType;
    }

    if ('type' in source && source.type) {
      urlSource.sourceType = source.type;

      if ((source.type === 'hls' || source.type === 'llhls' || source.type === 'dash') && source.keySystems !== undefined) {
        urlSource.keySystems = source.keySystems;
      }

      if (source.type === 'wrts') {
        const wrtsSource = source as CeeblueWRTSURLSource;

        if (wrtsSource.bufferLimitLow !== undefined) {
          urlSource.bufferLimitLow = wrtsSource.bufferLimitLow;
        }

        if (wrtsSource.bufferLimitHigh !== undefined) {
          urlSource.bufferLimitHigh = wrtsSource.bufferLimitHigh;
        }

        if (wrtsSource.reliable !== undefined) {
          urlSource.reliable = wrtsSource.reliable;
        }

        if (wrtsSource.cmcd !== undefined) {
          urlSource.cmcd = wrtsSource.cmcd;
        }

        if (wrtsSource.cmcdMode !== undefined) {
          urlSource.cmcdMode = wrtsSource.cmcdMode;
        }

        if (wrtsSource.cmcdSid !== undefined) {
          urlSource.cmcdSid = wrtsSource.cmcdSid;
        }
      }
    }

    return urlSource as VideojsSourceObject;
  }

  if (!isSourceControllerCloudSource(source)) {
    throw new Error(`Unknown source type expected URL source or Cloud source ${JSON.stringify(source)}`);
  }

  return buildCloudSource(source);
}

function buildCloudSource(source: CeeblueCloudSource): VideojsSourceObject[] {
  const usedProtocols = source.protocols?.length ? source.protocols : protocols;
  const sources: VideojsSourceObject[] = [];
  const hlsFormat = source.settings?.hls?.format ?? 'hls';

  for (const proto of usedProtocols) {
    if (!protocols.includes(proto)) {
      throw new Error(`Unknown protocol ${proto}`);
    }

    if (proto === 'webrtc') {
      sources.push(buildWebRTCSource(source));

      continue;
    }

    if (proto === 'wrts') {
      sources.push(buildWRTSSource(source));

      continue;
    }

    let urlPorotocol = '';
    let format = '';
    let index = '';
    let type = '';

    switch (proto) {
    case 'hls':
      urlPorotocol = 'https';
      format = hlsFormat;
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

    if (query.toString().length > 0) {
      url += `?${query.toString()}`;
    }

    const sourceObject: VideojsHTTPSourceObject = {
      src: url,
      type,
      sourceType: proto
    };

    const keySystems = proto === 'dash' ? source.settings?.dash?.keySystems : source.settings?.hls?.keySystems;

    if (keySystems !== undefined) {
      sourceObject.keySystems = keySystems;
    }

    sources.push(sourceObject);
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

function buildWRTSSource(source: CeeblueCloudSource): VideojsWRTSSourceObject {
  let url = `https://${source.endPoint}/wrts/${source.streamName}/index.json`;
  const query = source.query || new URLSearchParams();
  const wrtsSettings = source.settings?.wrts;

  if (source.accessToken) {
    query.set('id', source.accessToken);
  }

  if (query.toString().length > 0) {
    url += `?${query.toString()}`;
  }

  const sourceObject: VideojsWRTSSourceObject = {
    src: url,
    type: 'application/json',
    sourceType: 'wrts'
  };

  if (wrtsSettings?.bufferLimitLow !== undefined) {
    sourceObject.bufferLimitLow = wrtsSettings.bufferLimitLow;
  }

  if (wrtsSettings?.bufferLimitHigh !== undefined) {
    sourceObject.bufferLimitHigh = wrtsSettings.bufferLimitHigh;
  }

  if (wrtsSettings?.reliable !== undefined) {
    sourceObject.reliable = wrtsSettings.reliable;
  }

  if (wrtsSettings?.cmcd !== undefined) {
    sourceObject.cmcd = wrtsSettings.cmcd;
  }

  if (wrtsSettings?.cmcdMode !== undefined) {
    sourceObject.cmcdMode = wrtsSettings.cmcdMode;
  }

  if (wrtsSettings?.cmcdSid !== undefined) {
    sourceObject.cmcdSid = wrtsSettings.cmcdSid;
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

function mergeSourceWithGlobalSettings(source: CeeblueSource, globalSettings?: CeeblueSourcesSettings): CeeblueSource {
  if (!globalSettings || !isSourceControllerCloudSource(source)) {
    return source;
  }

  const settings = mergeSourceSettings(globalSettings, source.settings);

  if (settings === undefined) {
    return source;
  }

  return {
    ...source,
    settings
  };
}

function mergeSourceSettings(base?: CeeblueSourcesSettings, override?: CeeblueSourcesSettings): CeeblueSourcesSettings | undefined {
  if (!base && !override) {
    return undefined;
  }

  const mergedSettings: CeeblueSourcesSettings = {};
  const webrtc = mergeNamedSettings(base?.webrtc, override?.webrtc);
  const wrts = mergeNamedSettings(base?.wrts, override?.wrts);
  const hls = mergeNamedSettings(base?.hls, override?.hls);
  const dash = mergeNamedSettings(base?.dash, override?.dash);

  if (webrtc !== undefined) {
    mergedSettings.webrtc = webrtc;
  }

  if (wrts !== undefined) {
    mergedSettings.wrts = wrts;
  }

  if (hls !== undefined) {
    mergedSettings.hls = hls;
  }

  if (dash !== undefined) {
    mergedSettings.dash = dash;
  }

  return mergedSettings;
}

function mergeNamedSettings<T extends object>(base?: T, override?: T): T | undefined {
  if (!base) {
    return override;
  }

  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override
  };
}
