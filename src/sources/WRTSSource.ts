import videojs from 'video.js';
import { Player as WRTSPlayer, type CMCD, type CMCDMode, type Metadata, type PlayerError } from '@ceeblue/wrts-client';
import { WRTSTracksController } from '../controllers/WRTSTracksController';
import type Tech from 'video.js/dist/types/tech/tech';
import type Player from 'video.js/dist/types/player';
import type { CeeblueDRMKeySystems, CeeblueWRTSCMCD, CeeblueWRTSCMCDMode, VideojsWRTSSourceObject } from './sources';

export type WRTSSourceOptions = {
  readonly playerId: string;
}

type VideojsEMEOptions = {
  keySystems?: CeeblueDRMKeySystems;
};

type VideojsEMEPlugin = {
  options?: Record<string, unknown>;
  initializeMediaKeys?: (
    options: VideojsEMEOptions,
    callback?: (error?: unknown) => void,
    suppressErrorsIfPossible?: boolean
  ) => void;
};

type PlayerWithEME = Player & {
  eme?: VideojsEMEPlugin | ((options?: VideojsEMEOptions) => void);
};

type DRMContentTypes = {
  audioContentTypes: string[];
  videoContentTypes: string[];
};

const DRM_SYSTEM_IDS = {
  'com.microsoft.playready': '9a04f07998404286ab92e65be0885f95',
  'com.widevine.alpha': 'edef8ba979d64acea3c827dcd51d21ed'
} as const;

type MutableDRMKeySystemConfiguration = Record<string, unknown>;

function isFairPlayKeySystem(keySystem: string) {
  return keySystem.startsWith('com.apple.fps');
}

function toContentTypeValue(contentTypes: string[]) {
  if (!contentTypes.length) {
    return undefined;
  }

  return contentTypes.length === 1 ? contentTypes[0] : contentTypes;
}

function getEncryptedContentTypes(metadata: Metadata): DRMContentTypes {
  const audioContentTypes = new Set<string>();
  const videoContentTypes = new Set<string>();

  for (const track of metadata.audioTracks) {
    if (!track.contentProtection || !track.codecString) {
      continue;
    }

    audioContentTypes.add(`audio/mp4; codecs="${track.codecString}"`);
  }

  for (const track of metadata.videoTracks) {
    if (!track.contentProtection || !track.codecString) {
      continue;
    }

    videoContentTypes.add(`video/mp4; codecs="${track.codecString}"`);
  }

  return {
    audioContentTypes: Array.from(audioContentTypes),
    videoContentTypes: Array.from(videoContentTypes)
  };
}

function getPsshForKeySystem(keySystem: string, metadata: Metadata) {
  const drmSystemId = DRM_SYSTEM_IDS[keySystem as keyof typeof DRM_SYSTEM_IDS];

  if (!drmSystemId) {
    return undefined;
  }

  for (const [, contentProtection] of metadata.contentProtection) {
    const pssh = contentProtection.pssh.get(drmSystemId);

    if (pssh) {
      return Uint8Array.from(atob(pssh), c => c.charCodeAt(0) || 0);
    }
  }

  return undefined;
}

function normalizeKeySystemConfiguration(
  keySystem: string,
  keySystemConfig: string | MutableDRMKeySystemConfiguration,
  metadataSettings: {
    audioContentType?: string | string[];
    videoContentType?: string | string[];
    pssh?: Uint8Array;
  }
) {
  // FairPlay uses its own certificate/license flow and does not need WRTS-specific metadata enrichment.
  if (isFairPlayKeySystem(keySystem)) {
    return keySystemConfig;
  }

  if (typeof keySystemConfig === 'string') {
    const normalizedConfig: MutableDRMKeySystemConfiguration = {
      url: keySystemConfig
    };

    if (metadataSettings.pssh) {
      normalizedConfig.pssh = metadataSettings.pssh;
    }

    if (metadataSettings.audioContentType) {
      normalizedConfig.audioContentType = metadataSettings.audioContentType;
    }

    if (metadataSettings.videoContentType) {
      normalizedConfig.videoContentType = metadataSettings.videoContentType;
    }

    return normalizedConfig;
  }

  const normalizedConfig: MutableDRMKeySystemConfiguration = {
    ...keySystemConfig
  };

  // The external EME flow expects `url`, while our public API also accepts `licenseUri`.
  if (typeof normalizedConfig.licenseUri === 'string' && typeof normalizedConfig.url !== 'string') {
    normalizedConfig.url = normalizedConfig.licenseUri;
  }

  if (normalizedConfig.audioContentType === undefined && metadataSettings.audioContentType) {
    normalizedConfig.audioContentType = metadataSettings.audioContentType;
  }

  if (normalizedConfig.videoContentType === undefined && metadataSettings.videoContentType) {
    normalizedConfig.videoContentType = metadataSettings.videoContentType;
  }

  // Reusing the manifest PSSH keeps the WRTS EME path close to the LL-HLS/VHS flow.
  if (normalizedConfig.pssh === undefined && metadataSettings.pssh) {
    normalizedConfig.pssh = metadataSettings.pssh;
  }

  return normalizedConfig;
}

export function enrichWRTSKeySystemsWithMetadata(
  keySystems: CeeblueDRMKeySystems | undefined,
  metadata: Metadata
): CeeblueDRMKeySystems | undefined {
  if (!keySystems) {
    return keySystems;
  }

  const { audioContentTypes, videoContentTypes } = getEncryptedContentTypes(metadata);
  const audioContentType = toContentTypeValue(audioContentTypes);
  const videoContentType = toContentTypeValue(videoContentTypes);

  videojs.log('WRTS metadata encrypted content types', {
    audioContentType,
    videoContentType
  });

  if (!audioContentType && !videoContentType) {
    return keySystems;
  }

  const enrichedKeySystems: CeeblueDRMKeySystems = {};

  for (const keySystem in keySystems) {
    const keySystemConfig = keySystems[keySystem];

    if (keySystemConfig === undefined) {
      continue;
    }

    enrichedKeySystems[keySystem] = normalizeKeySystemConfiguration(
      keySystem,
      keySystemConfig,
      {
        audioContentType,
        videoContentType,
        pssh: getPsshForKeySystem(keySystem, metadata)
      }
    );
  }

  return enrichedKeySystems;
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
