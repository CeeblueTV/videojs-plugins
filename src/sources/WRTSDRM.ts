import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type { Metadata } from '@ceeblue/wrts-client';
import type { CeeblueDRMKeySystems } from './sources';

export type VideojsEMEOptions = {
  keySystems?: CeeblueDRMKeySystems;
};

export type VideojsEMEPlugin = {
  options?: Record<string, unknown>;
  initializeMediaKeys?: (
    options: VideojsEMEOptions,
    callback?: (error?: unknown) => void,
    suppressErrorsIfPossible?: boolean
  ) => void;
};

export type PlayerWithEME = Player & {
  eme?: VideojsEMEPlugin | ((options?: VideojsEMEOptions) => void);
};

// Linting workaround for the fact that the EME types are not globally available in TypeScript.
type BrowserMediaKeysRequirement = globalThis.MediaKeysRequirement;
type BrowserMediaKeySessionType = globalThis.MediaKeySessionType;
type BrowserMediaKeySystemConfiguration = globalThis.MediaKeySystemConfiguration;
type BrowserMediaKeySystemMediaCapability = globalThis.MediaKeySystemMediaCapability;

type DRMContentTypes = {
  audioContentTypes: string[];
  videoContentTypes: string[];
};

type DRMMetadataSettings = DRMContentTypes & {
  pssh?: Uint8Array;
};

type MutableDRMKeySystemConfiguration = Record<string, unknown>;

const DRM_SYSTEM_IDS = {
  'com.microsoft.playready': '9a04f07998404286ab92e65be0885f95',
  'com.widevine.alpha': 'edef8ba979d64acea3c827dcd51d21ed'
} as const;

function isFairPlayKeySystem(keySystem: string) {
  return keySystem.startsWith('com.apple.fps');
}

function normalizeStringValues(value: string | string[] | undefined) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function toCapabilities(
  contentTypes: string[],
  robustnesses: string[]
): BrowserMediaKeySystemMediaCapability[] {
  if (!contentTypes.length) {
    return [];
  }

  const normalizedRobustnesses = robustnesses.length ? robustnesses : [''];

  return contentTypes.flatMap(contentType => normalizedRobustnesses.map(robustness => {
    if (!robustness) {
      return { contentType };
    }

    return {
      contentType,
      robustness
    };
  }));
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

function createMediaKeySystemConfiguration(
  keySystemConfig: MutableDRMKeySystemConfiguration,
  metadataSettings: DRMMetadataSettings
) {
  const audioContentTypes = metadataSettings.audioContentTypes.length
    ? metadataSettings.audioContentTypes
    : normalizeStringValues(keySystemConfig.audioContentType as string | string[] | undefined);
  const videoContentTypes = metadataSettings.videoContentTypes.length
    ? metadataSettings.videoContentTypes
    : normalizeStringValues(keySystemConfig.videoContentType as string | string[] | undefined);

  if (!audioContentTypes.length && !videoContentTypes.length) {
    return undefined;
  }

  const configuration: BrowserMediaKeySystemConfiguration = {};

  if (Array.isArray(keySystemConfig.initDataTypes)) {
    configuration.initDataTypes = keySystemConfig.initDataTypes as string[];
  }

  if (typeof keySystemConfig.distinctiveIdentifier === 'string') {
    configuration.distinctiveIdentifier = keySystemConfig.distinctiveIdentifier as BrowserMediaKeysRequirement;
  }

  if (typeof keySystemConfig.persistentState === 'string') {
    configuration.persistentState = keySystemConfig.persistentState as BrowserMediaKeysRequirement;
  }

  if (Array.isArray(keySystemConfig.sessionTypes)) {
    configuration.sessionTypes = keySystemConfig.sessionTypes as BrowserMediaKeySessionType[];
  }

  const audioCapabilities = toCapabilities(
    audioContentTypes,
    normalizeStringValues(keySystemConfig.audioRobustness as string | string[] | undefined)
  );
  const videoCapabilities = toCapabilities(
    videoContentTypes,
    normalizeStringValues(keySystemConfig.videoRobustness as string | string[] | undefined)
  );

  if (audioCapabilities.length) {
    configuration.audioCapabilities = audioCapabilities;
  }

  if (videoCapabilities.length) {
    configuration.videoCapabilities = videoCapabilities;
  }

  return configuration;
}

function normalizeKeySystemConfiguration(
  keySystem: string,
  keySystemConfig: string | MutableDRMKeySystemConfiguration,
  metadataSettings: DRMMetadataSettings
) {
  // FairPlay has its own request/certificate flow and does not use the Widevine/PlayReady helpers below.
  if (isFairPlayKeySystem(keySystem)) {
    return keySystemConfig;
  }

  const normalizedConfig: MutableDRMKeySystemConfiguration = typeof keySystemConfig === 'string'
    ? { url: keySystemConfig }
    : { ...keySystemConfig };

  // The external EME flow expects `url`, while our public API also accepts `licenseUri`.
  if (typeof normalizedConfig.licenseUri === 'string' && typeof normalizedConfig.url !== 'string') {
    normalizedConfig.url = normalizedConfig.licenseUri;
  }

  // WRTS metadata already enumerates the encrypted codecs, so we eagerly convert them to
  // MediaKeySystemConfiguration and keep one code path for single and multi-codec streams.
  if (normalizedConfig.supportedConfigurations === undefined) {
    const mediaKeySystemConfiguration = createMediaKeySystemConfiguration(normalizedConfig, metadataSettings);

    if (mediaKeySystemConfiguration) {
      normalizedConfig.supportedConfigurations = [mediaKeySystemConfiguration];
      delete normalizedConfig.audioContentType;
      delete normalizedConfig.videoContentType;
    }
  }

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

  const contentTypes = getEncryptedContentTypes(metadata);

  videojs.log('WRTS metadata encrypted content types', {
    audioContentType: contentTypes.audioContentTypes.length === 1 ? contentTypes.audioContentTypes[0] : contentTypes.audioContentTypes,
    videoContentType: contentTypes.videoContentTypes.length === 1 ? contentTypes.videoContentTypes[0] : contentTypes.videoContentTypes
  });

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
        ...contentTypes,
        pssh: getPsshForKeySystem(keySystem, metadata)
      }
    );
  }

  return enrichedKeySystems;
}
