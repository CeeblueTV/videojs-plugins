import videojs from 'video.js';
import { Player, Util, WSController, HTTPConnector } from '@ceeblue/webrtc-client';
import { WebRTCTracksController } from '../controllers/WebRTCTracksController';
const Component = videojs.getComponent('Component');

/**
 * An advanced Video.js plugin for playing WebRTC stream from Ceeblue cloud.
 *
 */
export class WebRTCSource extends Component {

  /**
   * Create a WebRTC source handler instance.
   *
   * @param  {Object} source Source object that is given in the DOM, includes the stream URL
   *  and the source options : {iceservers: string|Object, audiobutton: true|false, data: true|false}
   * @param  {Object} tech The videojs tech object
   * @param  {Object} options The videojs options object
   */
  constructor(source, tech, options) {
    super(tech);

    videojs.log('WebRTCSource', source, options);
    this.player = videojs(options.playerId);
    this.source = source;

    // Check RTCPPeerConnection support
    if (!window.RTCPeerConnection) {
      this.player.error({code: 4, message: 'WebRTC is not supported by this browser'});
      return;
    }

    // Parse iceServers
    try {
      if (typeof source.iceservers === 'string') {
        this.source.iceservers = JSON.parse(source.iceservers);
      }
    } catch (e) {
      videojs.log('Malformated JSON : ', e && e.message);
    }

    // Parse URL
    const url = new URL(source.src);
    const streamName = url.pathname.split('/').pop();

    // erase the path
    url.pathname = '';

    // Create the WebRTC player
    this._abortController = new AbortController();
    this.webRTCPlayer = new Player(url.protocol.startsWith('http') ? HTTPConnector : WSController);
    this.webRTCPlayer.on('start', stream => {
      videojs.log('start playing');
      const vid = tech.el();

      if (vid.srcObject !== stream) {
        vid.srcObject = stream;
      }
      this.player.trigger('play');
    }, this._abortController);
    this.webRTCPlayer.on('stop', () => {
      videojs.log('stop playing');
      this.player.error({code: 4, message: 'The video playback was aborted'});
    }, this._abortController);
    this.webRTCPlayer.on('playing', playing => {
      // videojs.log('onPlaying', playing);
    }, this._abortController);
    this.webRTCPlayer.on('metadata', metadata => {
      videojs.log('onMetadata', metadata);
      this._tracksController.update(metadata);
    }, this._abortController);
    this.webRTCPlayer.onError = error => {
      videojs.log.error(error);
    };
    this.webRTCPlayer.on('log', log => {
      videojs.log('onLog', log);
    }, this._abortController);
    this.webRTCPlayer.start({host: url.host, streamName, iceServer: this.source.iceservers, query: Util.objectFrom(url.searchParams)});

    // Create the tracks controller
    this._tracksController = new WebRTCTracksController(this);
  }

  /**
   * Dispose the WebRTC source handler instance.
   */
  dispose() {
    if (this.webRTCPlayer) {
      this._abortController.abort();
      this.webRTCPlayer.stop();
      this.webRTCPlayer = null;
    }
    if (this._tracksController) {
      this._tracksController.reset();
      this._tracksController = null;
    }
    this.selectedVideoTrack = null;
    this.selectedAudioTrack = null;
    super.dispose();
  }
}
