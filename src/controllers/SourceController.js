import { utils } from '@ceeblue/webrtc-client';
import videojs from 'video.js';

const {EventEmitter, Connect, NetAddress} = utils;

// This is not exported because we access it with the plugin SourceController from :
// SourceController.SourceType
const SourceType = {
  HLS: 'hls',
  LLHLS: 'llhls',
  DASH: 'dash',
  WEBRTC: 'webrtc'
};

/**
 * Does the Videojs player source selection.
 * This class controls the order of the sources and the source selection.
 * It switches automatically to the next source if the current one fails.
 */
export class SourceController extends EventEmitter {
  /**
   * Event triggered when the source changes.
   *
   * @param {string|null} source the source to play or null if no more source is available
   */
  onSourceChanged(source) {}

  /**
   * Is the controller started?
   *
   * @return {boolean} true if the controller has been started
   */
  get started() {
    return this._sourceIndex > 0;
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
  set source(source) {
    for (let i = 0; i < this._sources.length; i++) {
      if (this._sources[i].sourceType === source) {
        this._sourceIndex = i;
        this._reset();
        this._tryNextSource();
        return;
      }
    }
    throw new Error('Unknown source ' + source);
  }

  /**
   * The list of possible source types
   */
  static get SourceType() {
    return SourceType;
  }

  /**
   * SourceController constructor
   *
   * @param {VideojsPlayer} player Videojs player
   * @param {Connect.Params} connectParams The Ceeblue connection parameters
   * @param {Array<SourceType|SourceObject>} sources an array of sources to try in order
   */
  constructor(player, connectParams, sources) {
    super();
    this._sourceIndex = 0;
    this._player = player;
    this._auto = true;
    this._sources = [];

    if (!sources || !sources.length) {
      throw new Error('SourceController sources must not be empty');
    }

    // Initiate the list of Source Objects
    for (let source of sources) {
      source = SourceController.sourceToObject(source, connectParams);
      if (source) {
        this._sources.push(source);
      }
    }
  }

  /**
   * Start the source controller, try the first source.
   *
   * @param {string?} sourceType the name of the selected source to start with, if null the first source is played
   */
  start(sourceType) {
    if (this.started) {
      videojs.log.error('SourceController already started');
      return;
    }
    this.source = sourceType || this._sources[0].sourceType;
  }

  /**
   * Stop the source controller, reset the player.
   */
  stop() {
    if (!this.started) {
      return;
    }
    this._sourceIndex = 0;
    this._reset();
  }

  /**
   * Convert a source type to a videojs source object compatible with Ceeblue Cloud
   *
   * @param {SourceType|SourceObject} source SourceType or Source Object
   * @param {Connect.Params} connectParams The Ceeblue connection parameters
   * @return {Object} a videojs source object for videojs or null if the parameters are invalid
   */
  static sourceToObject(source, connectParams) {

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
    this._player.off('error');
    this._player.off('loadedmetadata');
    this._player.off('ended');
    // important before starting a new source!
    this._player.pause();
    this._player.reset();
  }

  /**
   * Try the next source or ends if no more source is available.
   */
  _tryNextSource() {
    // Show error when all sources have been tried without success
    if (this._sourceIndex >= this._sources.length) {
      // end of sources
      this._sourceIndex = 0;
      this.onSourceChanged(null);
      return;
    }

    const newSource = this._sources[this._sourceIndex++];

    videojs.log('Trying source', newSource);
    this._player.on('error', (_, error) => {
      if (!error) {
        error = this._player.error() && this._player.error().message;
      }
      videojs.log('Player error : ', error);
      this._stopSource();
    });
    this._player.on('loadedmetadata', () => {
      videojs.log('loadedmetadata');
      this._player.qualityButton();
      this.onSourceChanged(newSource.sourceType);
    });
    this._player.on('ended', (e) => {
      videojs.log('Player ended');
      this._stopSource();
    });
    this._player.src(newSource);
  }

  /**
   * Stop the current source in the next time tick, then try next source.
   */
  _stopSource() {
    if (this._stopSourceTimeout) {
      // already stopping
      return;
    }
    this._stopSourceTimeout = setTimeout(() => {
      this._reset();
      if (this._auto) {
        this._tryNextSource();
      } else {
        this._sourceIndex = 0;
        this.onSourceChanged(null);
      }
      this._stopSourceTimeout = null;
    }, 0);
  }
}
