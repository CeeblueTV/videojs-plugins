/* eslint-disable no-undef */

const WebRTCSourceHandler = videojs.getTech('Html5').sourceHandlers.find((value) => value.name === 'ceeblue/videojs-plugins');
const EventEmitter = WebRTCSourceHandler.webrtcClient.EventEmitter;
const SourceController = videojs.getPlugin('SourceController');
const SourceType = SourceController.SourceType;

/**
 * Player class sample
 *
 * Allows to create your videojs player in few lines with all the `SourceController` features.
 *
 * Features of Player:
 * - Use default configuration of Ceeblue protocols (WebRTC, LLHLS, DASH, HLS)
 * - Instantiate the videojs player (avoid conflicts of usage)
 * - Has custom `retryCount` option to retry multiple time the list of sources
 * - Show modal dialog when all sources have failed (`options.modal = false` to disable)
 *
 * Usage :
 *
 * ```javascript
 * var player = new Player('video-player');
 *  player.start({host:'<ceeblue-host>', streamName: '<streamId>'});
 * ```
 */
export class Player extends EventEmitter {
  /**
   * Event triggered when the source changes.
   *
   * @param {string|null} source the source to play or null if no more source is available
   */
  onSourceChanged(source) {}

  /**
   * Set the current source dynamically
   *
   * @param {string} source the source type to play
   */
  set source(source) {
    this._sourceController.source = source;
  }

  /**
   * Get the videojs player instance
   */
  get player() {
    return this._player;
  }

  /**
   * Create a Player instance.
   *
   * The options can contain the following additional properties:
   * - retryCount: the number of times to retry to play the sources if all sources failed. Default: 0
   * - qualityButton: True to enable the quality button. Default: true
   * - modal: True to enable the modal dialogs. Default: true
   *
   * @param {string|HTMLVideoElement} idOrTag The id of the videojs player or the video element or the videojs player instance
   * @param {Object} options The videojs options for the player
   */
  constructor(idOrTag, options = {}) {
    super();
    if (typeof idOrTag === 'string' || idOrTag instanceof HTMLVideoElement) {
      this._player = videojs(idOrTag, options);
    } else {
      throw new Error('The first argument must be a string or an HTMLVideoElement');
    }
    this._modal = options.modal !== false;
    this._totalRetryCount = options.retryCount || 0;
    this._retryCount = 0;
    this._sources = undefined;
    this._connectParams = undefined;

    this._sourceController = new SourceController(this._player);
    this._sourceController.onSourceChanged = (source) => {
      if (!source) {
        if (this._retryCount < this._totalRetryCount) {
          this._retryCount++;
          videojs.log('Retry to play the sources', this._retryCount, '/', this._totalRetryCount);
          setTimeout(() => {
            this._sourceController.start(this._connectParams, this._sources);
          }, 0);
          return;
        }

        videojs.log('Playback stopped, all sources failed');
        if (this._modal) {
          const ModalDialog = videojs.getComponent('ModalDialog');
          const errorModal = new ModalDialog(this._player, {
            content: 'Playback stopped, all sources failed',
            temporary: true,
            pauseOnOpen: false
          });

          this._player.addChild(errorModal);
          errorModal.open();
        }
      }
      this.onSourceChanged(source);
    };
  }

  /**
   * Start the Player with the given connect parameters and sources
   * A source can be a SourceType or a SourceObject containing the source type, the source URL and the source options
   * The sources will be tried in order until the first one works or until there is no more source to try.
   *
   * @param {ConnectParams} connectParams the connection parameters
   * @param {Array<SourceType|SourceObject>?} sources an array of sources to try in order
   */
  start(connectParams, sources = [SourceType.WEBRTC, SourceType.LLHLS, SourceType.DASH, SourceType.HLS]) {
    if (this._sourceController.started) {
      return;
    }

    this._retryCount = 0;
    this._connectParams = {...connectParams};
    this._sources = [...sources];
    this._sourceController.start(this._connectParams, this._sources);
  }

  /**
   * Stop the Player
   */
  stop() {
    this._sourceController.stop();
  }

  /**
   * Dispose the Player
   */
  dispose() {
    this._sourceController.stop();
    this._player.dispose();
  }
}
