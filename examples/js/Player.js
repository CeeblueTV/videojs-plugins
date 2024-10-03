/* eslint-disable no-undef */

const WebRTCSourceHandler = videojs.getTech('Html5').sourceHandlers.find((value) => value.name === 'ceeblue/videojs-plugins');
const EventEmitter = WebRTCSourceHandler.webrtcClient.utils.EventEmitter;
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
 *  player.start({endPoint:'<ceeblue-host>', streamName: '<streamId>'});
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
   * - auto: True to automatically switch to the next source if the current one fails. Default: true
   *
   * @param {string|HTMLVideoElement} idOrTag The id of the videojs player or the video element or the videojs player instance
   * @param {ConnectParams} connectParams the connection parameters
   * @param {Array<SourceType|SourceObject>?} sources an array of sources to try in order
   * @param {Object} options The videojs options for the player
   */
  constructor(idOrTag, connectParams, sources = [SourceType.WEBRTC, SourceType.LLHLS, SourceType.DASH, SourceType.HLS], options = {}) {
    super();
    if (typeof idOrTag === 'string' || idOrTag instanceof HTMLVideoElement) {
      this._player = videojs(idOrTag, options);
    } else {
      throw new Error('The first argument must be a string or an HTMLVideoElement');
    }
    this._modal = options.modal !== false;
    this._totalRetryCount = options.retryCount || 0;
    this._retryCount = 0;

    this._sourceController = new SourceController(this._player, {...connectParams}, [...sources]);
    this._sourceController.auto = options.auto !== false;
    this._sourceController.onSourceChanged = (source) => {
      if (!source && options.auto) {
        if (this._retryCount < this._totalRetryCount) {
          this._retryCount++;
          videojs.log('Retry to play the sources', this._retryCount, '/', this._totalRetryCount);
          setTimeout(() => {
            this._sourceController.start();
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
   * Start the Player with the given SourceType
   *
   * @param {String?} sourceType the name of the selected source to start with, if null the first source is played
   */
  start(sourceType) {
    if (this._sourceController.started) {
      return;
    }

    this._retryCount = 0;
    this._sourceController.start(sourceType);
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
