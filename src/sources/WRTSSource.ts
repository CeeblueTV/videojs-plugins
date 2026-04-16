import videojs from 'video.js';
import { Player as WRTSPlayer, type CMCD, type CMCDMode, type Metadata } from '@ceeblue/wrts-client';
import { WRTSTracksController } from '../controllers/WRTSTracksController';
import type Tech from 'video.js/dist/types/tech/tech';
import type Player from 'video.js/dist/types/player';
import type { CeeblueWRTSCMCD, CeeblueWRTSCMCDMode, VideojsWRTSSourceObject } from './sources';

export type WRTSSourceOptions = {
  readonly playerId: string;
}

/**
 * Video.js source handler for WebRTS streams.
 */
export class WRTSSource {
  wrtsPlayer: WRTSPlayer;

  get bufferLimitLow() {
    return this.wrtsPlayer.bufferLimitLow;
  }

  set bufferLimitLow(value: number | undefined) {
    if (value === undefined) {
      return;
    }

    this.wrtsPlayer.bufferLimitLow = value;
  }

  get bufferLimitHigh() {
    return this.wrtsPlayer.bufferLimitHigh;
  }

  set bufferLimitHigh(value: number | undefined) {
    if (value === undefined) {
      return;
    }

    this.wrtsPlayer.bufferLimitHigh = value;
  }

  get reliable() {
    return this.wrtsPlayer.reliable;
  }

  set reliable(value: boolean | undefined) {
    this._pendingRuntimeSettings.reliable = value;

    if (value !== undefined && this.wrtsPlayer.started) {
      this.wrtsPlayer.reliable = value;
    }
  }

  get cmcd() {
    return this.wrtsPlayer.cmcd;
  }

  set cmcd(value: CeeblueWRTSCMCD | undefined) {
    this._pendingRuntimeSettings.cmcd = value;

    if (this.wrtsPlayer.started) {
      this.wrtsPlayer.cmcd = value;
    }
  }

  get cmcdMode() {
    return this.wrtsPlayer.cmcdMode;
  }

  set cmcdMode(value: CeeblueWRTSCMCDMode | undefined) {
    this._pendingRuntimeSettings.cmcdMode = value;

    if (this.wrtsPlayer.started) {
      this.wrtsPlayer.cmcdMode = value;
    }
  }

  get cmcdSid() {
    return this.wrtsPlayer.cmcdSid;
  }

  set cmcdSid(value: string | undefined) {
    this._pendingRuntimeSettings.cmcdSid = value;

    if (this.wrtsPlayer.started) {
      this.wrtsPlayer.cmcdSid = value;
    }
  }

  get source() {
    return this._source;
  }

  get player() {
    return this._player;
  }

  private readonly _tracksController: WRTSTracksController;
  private readonly _source: VideojsWRTSSourceObject;
  private readonly _player: Player;
  private readonly _pendingRuntimeSettings: {
    reliable: boolean | undefined;
    cmcd: CMCD | undefined;
    cmcdMode: CMCDMode | undefined;
    cmcdSid: string | undefined;
  };

  constructor(source: VideojsWRTSSourceObject, tech: Tech, options: WRTSSourceOptions) {
    this._player = videojs(options.playerId);
    this._source = source;

    if (typeof source.src !== 'string') {
      const error = new TypeError('Invalid WRTS source');

      this.player.error(error.message);
      throw error;
    }

    const videoElement = tech?.el?.() as HTMLVideoElement | null;

    if (!videoElement) {
      const error = new Error('Video element not found for WRTS source');

      this.player.error(error.message);
      throw error;
    }

    this.wrtsPlayer = new WRTSPlayer(videoElement);
    this._pendingRuntimeSettings = {
      reliable: source.reliable,
      cmcd: source.cmcd,
      cmcdMode: source.cmcdMode,
      cmcdSid: source.cmcdSid
    };

    if (source.bufferLimitLow !== undefined) {
      this.wrtsPlayer.bufferLimitLow = source.bufferLimitLow;
    }

    if (source.bufferLimitHigh !== undefined) {
      this.wrtsPlayer.bufferLimitHigh = source.bufferLimitHigh;
    }

    this.wrtsPlayer.onStart = this._handleStart.bind(this);
    this.wrtsPlayer.onStop = this._handleStop.bind(this);
    this.wrtsPlayer.onMetadata = this._handleMetadata.bind(this);
    this._tracksController = new WRTSTracksController(this);
    this.wrtsPlayer.start({
      endPoint: source.src
    });
  }

  _handleStart() {
    this._applyPendingRuntimeSettings();
    this.player.trigger('play');
  }

  _handleStop(error?: unknown) {
    if (error) {
      this.player.error('WRTS playback stopped');
      return;
    }

    this.player.trigger('ended');
  }

  _handleMetadata(metadata: Metadata) {
    this._tracksController?.update(metadata);
  }

  private _applyPendingRuntimeSettings() {
    if (this._pendingRuntimeSettings.reliable !== undefined) {
      this.wrtsPlayer.reliable = this._pendingRuntimeSettings.reliable;
    }

    this.wrtsPlayer.cmcd = this._pendingRuntimeSettings.cmcd;
    this.wrtsPlayer.cmcdMode = this._pendingRuntimeSettings.cmcdMode;
    this.wrtsPlayer.cmcdSid = this._pendingRuntimeSettings.cmcdSid;
  }

  dispose() {
    if (this._tracksController) {
      this._tracksController.dispose();
    }

    if (this.wrtsPlayer) {
      this.wrtsPlayer.stop();
    }
  }
}
