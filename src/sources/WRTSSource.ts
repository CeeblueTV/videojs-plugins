import videojs from 'video.js';
import { Player as WRTSPlayer, type CMCD, type CMCDMode, type Metadata, type PlayerError } from '@ceeblue/wrts-client';
import { WRTSTracksController } from '../controllers/WRTSTracksController';
import type Tech from 'video.js/dist/types/tech/tech';
import type Player from 'video.js/dist/types/player';
import { enrichWRTSKeySystemsWithMetadata, type PlayerWithEME } from './WRTSDRM';
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
  private _mediaKeysInitializationAttempted = false;

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

    this._applyStaticSourceSettings(source);
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

  _handleStop(error?: PlayerError | undefined) {
    if (error) {
      this.player.error('WRTS playback stopped, error : ' + error.name);
      return;
    }

    this.player.trigger('ended');
  }

  _handleMetadata(metadata: Metadata) {
    this._prepareEMEConfiguration(metadata);
    videojs.log('WRTS metadata received', metadata);
    this._tracksController?.update(metadata);
  }

  /**
   * Try to initialize EME MediaKeys with the codecs and ContentProtection settings provided
   * in the WRTS manifest
   *
   * @param metadata Metadata of the WRTS stream
   */
  private _prepareEMEConfiguration(metadata: Metadata) {
    if (!metadata.contentProtection.size) {
      return;
    }

    const keySystems = enrichWRTSKeySystemsWithMetadata(this._source.keySystems, metadata);

    if (!keySystems) {
      return;
    }

    this._source.keySystems = keySystems;

    if (this._mediaKeysInitializationAttempted) {
      return;
    }

    const eme = (this.player as PlayerWithEME).eme;

    if (!eme || typeof eme === 'function') {
      return;
    }

    eme.options = {
      ...(eme.options || {}),
      keySystems
    };

    this._mediaKeysInitializationAttempted = true;

    videojs.log('Initializing WRTS EME MediaKeys from metadata key systems', { keySystems });

    if (typeof eme.initializeMediaKeys !== 'function') {
      return;
    }

    eme.initializeMediaKeys(
      { keySystems },
      error => {
        if (error) {
          this._mediaKeysInitializationAttempted = false;
          videojs.log.warn('WRTS EME initializeMediaKeys failed', error);
          return;
        }

        videojs.log('WRTS EME MediaKeys initialized from metadata');
      },
      true
    );
  }

  private _applyStaticSourceSettings(source: VideojsWRTSSourceObject) {
    if (source.bufferLimitLow !== undefined) {
      this.wrtsPlayer.bufferLimitLow = source.bufferLimitLow;
    }

    if (source.bufferLimitHigh !== undefined) {
      this.wrtsPlayer.bufferLimitHigh = source.bufferLimitHigh;
    }
  }

  private _applyPendingRuntimeSettings() {
    // These options may be set before the WRTS player reports `onStart`, so we re-apply
    // the latest values once the internal transport is fully initialized.
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
