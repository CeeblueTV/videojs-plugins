import videojs from 'video.js';
import { Player as WebRTCPlayer, WSController, HTTPConnector, Metadata } from '@ceeblue/webrtc-client';
import { WebRTCTracksController } from '../controllers/WebRTCTracksController';
import type Tech from 'video.js/dist/types/tech/tech';
import type { VideojsWebRTCSourceObject } from './sources';
import type Player from 'video.js/dist/types/player';
export type WebRTCSourceOptions = {
  readonly playerId: string;
}

/**
 * An advanced Video.js plugin for playing WebRTC stream from Ceeblue cloud.
 *
 */
export class WebRTCSource {
  /**
   * The WebRTC player instance.
   * Destroyed when the source is disposed.
   */
  webRTCPlayer: WebRTCPlayer;

  /**
   * WebRTC source settings.
   */
  get source() {
    return this._source;
  }

  /**
   * Video.js player instance.
   */
  get player() {
    return this._player;
  }

  /**
   * The tracks controller instance.
   */
  private readonly _tracksController: WebRTCTracksController;

  /**
   * Abort controller to stop the WebRTC player.
   */
  private readonly _abortController: AbortController;

  /**
   * Video.js tech object.
   */
  private readonly _tech: Tech;

  /**
   * Source options.
   */
  private readonly _source: VideojsWebRTCSourceObject;

  /**
   * Video.js player instance.
   */
  private readonly _player: Player;

  /**
   * Create a WebRTC source handler instance.
   *
   * @param Source object that is given in the DOM, includes the stream URL
   *  and the source options : {iceserver: string|Object, audiobutton: true|false, data: true|false}
   * @param tech The videojs tech object
   * @param options The videojs options object
   */
  constructor(source: VideojsWebRTCSourceObject, tech: Tech, options: WebRTCSourceOptions) {
    this._tech = tech;
    this._player = videojs(options.playerId);
    this._source = source;

    // Check RTCPeerConnection support
    if (!window.RTCPeerConnection) {
      const error = new Error('WebRTC is not supported by this browser');

      this.player.error(error.message);
      throw error;
    }

    if (typeof source.src !== 'string') {
      const error = new TypeError('Invalid WebRTC source');

      this.player.error(error.message);
      throw error;
    }

    this._abortController = new AbortController();
    this.webRTCPlayer = new WebRTCPlayer(source.src.startsWith('http') ? HTTPConnector : WSController);
    this.webRTCPlayer.on('start', this._handleStart.bind(this));
    this.webRTCPlayer.on('stop', this._handleStop.bind(this));
    this.webRTCPlayer.on('metadata', this._handleMetadata.bind(this));

    // temporary fix
    const url = new URL(source.src);

    this.webRTCPlayer.start({
      endPoint: url.hostname,
      streamName: url.pathname.split('/').pop() ?? '',
      iceServer: source?.iceServers?.[0] ?? this.defaultICEServer(source.src)
    });

    // Create the tracks controller
    this._tracksController = new WebRTCTracksController(this);
  }

  /**
   * Handle pause event from video.js player
   */
  _handlePause() {
    if (this.webRTCPlayer) {
      const vid = this._tech?.el?.() as HTMLVideoElement;

      if (vid) {
        vid.pause();
      }
    }
  }

  /**
   * Handle play event from video.js player
   */
  _handlePlay() {
    if (this.webRTCPlayer) {
      const vid = this._tech?.el?.() as HTMLVideoElement;

      if (vid) {
        vid.play();
      }
    }
  }

  /**
   * Return the default ice server for Ceeblue Edge.
   * This is used if ICE servers aren't explicitly provided.
   */
  defaultICEServer(src: string): RTCIceServer {
    const url = new URL(src);

    return {
      urls: ['turn:' + url.hostname + ':3478?transport=tcp', 'turn:' + url.hostname + ':3478'],
      username: 'ceeblue',
      credential: 'ceeblue'
    };
  }

  /**
   * Handle webRTCPlayer start event.
   */
  _handleStart(stream: MediaProvider) {
    const vid = this._tech?.el?.() as HTMLVideoElement;

    if (vid.srcObject !== stream) {
      vid.srcObject = stream;
    }

    this.player.trigger('play');
  }

  /**
   * Handle webRTCPlayer stop event.
   */
  _handleStop() {
    this.player.trigger('ended');
  }

  /**
   * Handle webRTCPlayer metadata event.
   */
  _handleMetadata(metadata: Metadata) {
    this._tracksController?.update(metadata);

    const dataTracks = [];

    for (const track of metadata.datas) {
      dataTracks.push(track.idx);
    }
    this.webRTCPlayer.dataTracks = dataTracks;
  }

  /**
   * Dispose the WebRTC source handler instance.
   */
  dispose() {
    if (this.webRTCPlayer) {
      this._abortController.abort();
      this.webRTCPlayer.stop();
    }

    if (this._tracksController) {
      this._tracksController.dispose();
    }
  }
}
