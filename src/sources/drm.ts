import type { CeeblueDRMKeySystems, CeeblueDRMKeySystemConfiguration } from './sources';

// Linting workaround for EME lib types that are not globally available in this config.
type BrowserMediaKeySystemMediaCapability = globalThis.MediaKeySystemMediaCapability;
type BrowserMediaKeySystemConfiguration = globalThis.MediaKeySystemConfiguration;

// Generic MP4 content types used only for EME capability negotiation — the real
// playback codecs are negotiated separately through MSE. These mirror the defaults
// videojs-contrib-eme uses internally for CDM detection.
export const DRM_DEFAULT_AUDIO_CONTENT_TYPE = 'audio/mp4;codecs="mp4a.40.2"';
export const DRM_DEFAULT_VIDEO_CONTENT_TYPE = 'video/mp4;codecs="avc1.42E01E"';

export function isFairPlayKeySystem(keySystem: string): boolean {
  return keySystem.startsWith('com.apple.fps');
}

/**
 * Normalize a content-type value to a list. A single contentType can itself contain
 * commas (e.g. multiple codecs), so the value is never comma-split.
 *
 * @param value a content type, a list of them, or undefined
 */
export function normalizeContentTypeValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

/**
 * Normalize a robustness value to a list. Unlike content types, a robustness value is a
 * single token, so comma-separated strings are split into their individual levels.
 *
 * @param value a robustness level, a list of them, a comma-separated string, or undefined
 */
export function normalizeRobustnessValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return (Array.isArray(value) ? value : [value])
    .flatMap(entry => entry.split(','))
    .map(entry => entry.trim())
    .filter(Boolean);
}

/**
 * Build the EME media capabilities for one media type: one capability per content
 * type × robustness pair (robustness omitted when empty).
 *
 * @param contentTypes the content types to advertise
 * @param robustnesses the robustness levels to advertise
 */
export function toCapabilities(contentTypes: string[], robustnesses: string[]): BrowserMediaKeySystemMediaCapability[] {
  if (!contentTypes.length) {
    return [];
  }

  const normalizedRobustnesses = robustnesses.length ? robustnesses : [''];

  return contentTypes.flatMap(contentType => normalizedRobustnesses.map(robustness =>
    robustness ? { contentType, robustness } : { contentType }));
}

/**
 * Default content types to advertise when a key-system config requests robustness but
 * carries no explicit content types (e.g. for HLS/DASH, where the codecs are not known
 * ahead of the EME negotiation).
 */
export type EmeContentTypeDefaults = {
  audioContentTypes?: string[];
  videoContentTypes?: string[];
};

/**
 * Reshape a keySystems map into something videojs-contrib-eme can consume for MSE
 * (HLS/DASH) playback.
 *
 * A bare license URL — a string, or an object with only `url`/`licenseUri` — is left
 * as-is: it maps to an always-supported empty EME configuration. As soon as robustness
 * or explicit content types are present the entry is rewritten to a full
 * `supportedConfigurations` array, because contrib-eme forwards `robustness` verbatim
 * into a single capability (so arrays/comma-lists are invalid) and every capability
 * needs a contentType — otherwise requestMediaKeySystemAccess throws
 * "Unsupported keySystem or supportedConfigurations". FairPlay and entries that already
 * carry `supportedConfigurations` are passed through untouched.
 *
 * @param keySystems the key systems to normalize
 * @param defaults content types to fall back to when none are configured
 */
export function normalizeKeySystemsForEME(
  keySystems: CeeblueDRMKeySystems,
  defaults: EmeContentTypeDefaults = {}
): CeeblueDRMKeySystems {
  const normalized: CeeblueDRMKeySystems = {};

  for (const keySystem in keySystems) {
    const config = keySystems[keySystem];

    if (config === undefined) {
      continue;
    }

    normalized[keySystem] = normalizeKeySystemConfigForEME(keySystem, config, defaults);
  }

  return normalized;
}

function normalizeKeySystemConfigForEME(
  keySystem: string,
  config: string | CeeblueDRMKeySystemConfiguration,
  defaults: EmeContentTypeDefaults
): string | CeeblueDRMKeySystemConfiguration {
  // A bare license URL is already an always-supported (empty) EME configuration.
  if (typeof config === 'string') {
    return config;
  }

  // FairPlay has its own certificate/license flow and must not be reshaped here.
  if (isFairPlayKeySystem(keySystem)) {
    return config;
  }

  // Respect an explicit configuration provided by the caller.
  if (config.supportedConfigurations) {
    return config;
  }

  const audioRobustness = normalizeRobustnessValues(config.audioRobustness);
  const videoRobustness = normalizeRobustnessValues(config.videoRobustness);
  const audioContentTypes = normalizeContentTypeValues(config.audioContentType);
  const videoContentTypes = normalizeContentTypeValues(config.videoContentType);

  // Nothing that needs reshaping: leave the bare config (url + headers, etc.) untouched
  // so it maps to an always-supported empty EME configuration.
  if (!audioRobustness.length && !videoRobustness.length && !audioContentTypes.length && !videoContentTypes.length) {
    return config;
  }

  const audioCapabilities = toCapabilities(
    audioContentTypes.length ? audioContentTypes : (defaults.audioContentTypes ?? []),
    audioRobustness
  );
  const videoCapabilities = toCapabilities(
    videoContentTypes.length ? videoContentTypes : (defaults.videoContentTypes ?? []),
    videoRobustness
  );

  if (!audioCapabilities.length && !videoCapabilities.length) {
    return config;
  }

  const supportedConfiguration: BrowserMediaKeySystemConfiguration = {
    initDataTypes: Array.isArray(config.initDataTypes) ? config.initDataTypes : ['cenc']
  };

  if (audioCapabilities.length) {
    supportedConfiguration.audioCapabilities = audioCapabilities;
  }

  if (videoCapabilities.length) {
    supportedConfiguration.videoCapabilities = videoCapabilities;
  }

  // The robustness/content-type shorthands are now encoded in supportedConfigurations.
  const normalizedConfig: CeeblueDRMKeySystemConfiguration = { ...config };

  delete normalizedConfig.audioContentType;
  delete normalizedConfig.videoContentType;
  delete normalizedConfig.audioRobustness;
  delete normalizedConfig.videoRobustness;
  normalizedConfig.supportedConfigurations = [supportedConfiguration];

  return normalizedConfig;
}
