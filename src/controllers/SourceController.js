import { utils } from '@ceeblue/webrtc-client';
import videojs from 'video.js';

const {Connect, NetAddress} = utils;

// This is not exported because we access it with the plugin SourceController from :
// SourceController.SourceType
const SourceType = {
  HLS: 'hls',
  LLHLS: 'llhls',
  DASH: 'dash',
  WEBRTC: 'webrtc'
};

const Plugin = videojs.getPlugin('plugin');

/**
 * Does the Videojs player source selection.
 * This class controls the order of the sources and the source selection.
 * It switches automatically to the next source if the current one fails.
 */
export class SourceController extends Plugin {
  /**
   * The list of possible source types
   */
  static get SourceType() {
    return SourceType;
  }

  /**
   * Set the auto mode
   *
   * @param {boolean} value true to automatically switch to the next source if the current one fails
   */
  set auto(value) {
    this._auto = value;
  }

  /**
   * Set the current source dynamically
   *
   * @param {string} source the source type to play
   */
  set sourceType(source) {
    if (!this._sources.has(source)) {
      throw new Error('Unknown source ' + source);
    }

    this._sourceType = source;
    this._reset();
    this._trySource();
  }

  /**
   * Get the current source type
   */
  get sourceType() {
    return this._sourceType;
  }

  /**
   * Get list of all available source types.
   */
  get sourceTypes() {
    return [...this._sources.keys()];
  }

  /**
   * SourceController constructor
   *
   * @param {VideojsPlayer} player Videojs player instance
   * @param {SourceObject} options The source controller options.
   */
  constructor(player, options) {
    super(player, options);

    const connectParams = options?.connectParams;
    const sourceTypes = options?.sourceTypes || [
      SourceType.WEBRTC, SourceType.LLHLS, SourceType.DASH, SourceType.HLS
    ];

    this._sourceType = options?.sourceType || sourceTypes[0];
    this._player = player;
    this._auto = !!(options?.autoRetry || true);
    this._maxRetryCount = options?.maxRetries || sourceTypes.length;
    this._sources = new Map();

    if (!sourceTypes || !sourceTypes.length) {
      throw new Error('SourceController sources must not be empty');
    }

    // Initiate the list of Source Objects
    for (let source of sourceTypes) {
      source = this.sourceToObject(source, connectParams);
      if (source) {
        this._sources.set(source.sourceType, source);
      }
    }

    player.on('error', this._onError.bind(this));
    player.on('ended', this._onEnded.bind(this));
    player.on('loadedmetadata', this._onLoadedMetadata.bind(this));
    player.ready(() => {
      this.sourceType = this._sourceType;
    });
  }

  /**
   * Convert a source type to a videojs source object compatible with Ceeblue Cloud
   *
   * @param {SourceType|SourceObject} source SourceType or Source Object
   * @param {Connect.Params} connectParams The Ceeblue connection parameters
   * @return {Object} a videojs source object for videojs or null if the parameters are invalid
   */
  sourceToObject(source, connectParams) {
    if (typeof source !== 'string') {
      // Already a source object, set the sourceType and check the src property
      if (source.src === undefined) {
        videojs.log.error('SourceObject must have src');
        return null;
      }

      // Parse the MIME type to get the SourceType, by default it's WEBRTC
      source.sourceType = SourceType.WEBRTC;
      if (source.type !== undefined) {
        switch (source.type) {
        case 'application/vnd.apple.mpegurl':
          source.sourceType = source.src.includes('/hls/') ? SourceType.HLS : SourceType.LLHLS;
          break;
        case 'application/dash+xml':
          source.sourceType = SourceType.DASH;
          break;
        default:
          videojs.log.warn('Unknown source type ' + source.type + ' using the MIME type instead');
          source.sourceType = source.type;
          break;
        }
      }
      return source;
    }
    if (connectParams.endPoint === undefined || connectParams.streamName === undefined) {
      videojs.log.error('ConnectParams must have endPoint and streamName');
      return null;
    }

    connectParams.endPoint = connectParams.endPoint;
    let host = new NetAddress(connectParams.endPoint);
    const domain = host.domain;
    const result = {sourceType: source};

    host = domain + ((host.port) ? (':' + host.port) : '');

    // Construct the source object from the source type and the connection parameters
    switch (source) {
    case SourceType.HLS:
      result.src = `https://${host}/hls/${connectParams.streamName}/index.m3u8`;
      result.type = 'application/vnd.apple.mpegurl';
      break;
    case SourceType.LLHLS:
      result.src = `https://${host}/cmaf/${connectParams.streamName}/index.m3u8`;
      result.type = 'application/vnd.apple.mpegurl';
      break;
    case SourceType.DASH:
      result.src = `https://${host}/cmaf/${connectParams.streamName}/index.mpd`;
      result.type = 'application/dash+xml';
      break;
    case SourceType.WEBRTC:
      const protocol = connectParams.endPoint.startsWith('https://') ? 'https' : 'wss';

      result.src = Connect.buildURL(Connect.Type.WEBRTC, connectParams, protocol).toString();
      result.iceserver = connectParams.iceServer;
      if (!result.iceserver) {
        // Use the default ICE servers structure
        result.iceserver = {
          urls: ['turn:' + domain + ':3478?transport=tcp', 'turn:' + domain + ':3478'],
          username: 'ceeblue',
          credential: 'ceeblue'
        };
      }
      break;
    default:
      videojs.log.error('Unknown source type ' + source);
      return null;
    }

    // add token as query parameter
    if (source !== SourceType.WEBRTC && connectParams.accessToken) {
      result.src += '?id=' + connectParams.accessToken;
    }
    return result;
  }

  /**
   * Reset the player
   */
  _reset() {
    // important before starting a new source!
    this._player.pause();
    this._player.reset();
  }

  /**
   * Try the next source or ends if no more source is available.
   */
  _trySource() {
    const newSource = this._sources.get(this._sourceType);

    videojs.log('Trying source', newSource);
    this._player.src(newSource);
  }

  /**
   * Stop the current source in the next time tick, then try next source.
   */
  _tryNextSource() {
    if (!this._auto || this._sources.size === 1) {
      this._onSourceChanged(void 0);
      return;
    }

    if (this._retryCount >= this._maxRetryCount) {
      return;
    }

    if (this._stopSourceTimeout) {
      return;
    }

    this._stopSourceTimeout = setTimeout(() => {
      const sourcesTypes = this.sourceTypes;
      const sourceIndex = sourcesTypes.indexOf(this._sourceType);
      const nextSource = sourcesTypes[(sourceIndex + 1) % sourcesTypes.length];

      this._sourceType = nextSource;

      this._reset();
      this._trySource();
      this._retryCount++;
      this._stopSourceTimeout = void 0;
    }, 100);
  }

  /**
   * Handle videojs error event
   * @param {Event} _ the error event
   * @param {string} error the error message
   */
  _onError(_, error) {
    if (!error) {
      error = this._player.error() && this._player.error().message;
    }
    videojs.log('Player error : ', error);
    this._tryNextSource();
  }

  /**
   * Handle videojs ended event.
   */
  _onEnded() {
    videojs.log('Player ended');
    this._tryNextSource();
  }

  /**
   * Handle videojs loadedmetadata event.
   */
  _onLoadedMetadata() {
    videojs.log('Player loadedmetadata');
    this._onSourceChanged(this.sourceType);
  }

  /**
   * Event triggered when the source changes.
   *
   * @param {string|null} source the source to play or null if no more source is available
   */
  _onSourceChanged(source) {
    this.trigger({
      type: 'sourcechanged',
      details: { source }
    });
  }
}
