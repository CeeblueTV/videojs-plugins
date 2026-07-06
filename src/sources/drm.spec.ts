import { describe, expect, it } from 'vitest';
import { normalizeKeySystemsForEME } from './drm';

const defaults = {
  audioContentTypes: ['audio/mp4;codecs="mp4a.40.2"'],
  videoContentTypes: ['video/mp4;codecs="avc1.42E01E"']
};

describe('normalizeKeySystemsForEME', () => {
  it('leaves a bare license URL string untouched', () => {
    const keySystems = normalizeKeySystemsForEME({
      'com.widevine.alpha': 'https://widevine.example.com'
    }, defaults);

    expect(keySystems).toEqual({
      'com.widevine.alpha': 'https://widevine.example.com'
    });
  });

  it('leaves a bare url object untouched', () => {
    const keySystems = normalizeKeySystemsForEME({
      'com.widevine.alpha': { url: 'https://widevine.example.com' }
    }, defaults);

    expect(keySystems).toEqual({
      'com.widevine.alpha': { url: 'https://widevine.example.com' }
    });
  });

  it('expands array robustness into one capability per level using default content types', () => {
    const keySystems = normalizeKeySystemsForEME({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        audioRobustness: ['HW_SECURE_CRYPTO', 'SW_SECURE_CRYPTO'],
        videoRobustness: ['HW_SECURE_DECODE', 'SW_SECURE_DECODE']
      }
    }, defaults);

    expect(keySystems).toEqual({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        supportedConfigurations: [{
          initDataTypes: ['cenc'],
          audioCapabilities: [
            { contentType: 'audio/mp4;codecs="mp4a.40.2"', robustness: 'HW_SECURE_CRYPTO' },
            { contentType: 'audio/mp4;codecs="mp4a.40.2"', robustness: 'SW_SECURE_CRYPTO' }
          ],
          videoCapabilities: [
            { contentType: 'video/mp4;codecs="avc1.42E01E"', robustness: 'HW_SECURE_DECODE' },
            { contentType: 'video/mp4;codecs="avc1.42E01E"', robustness: 'SW_SECURE_DECODE' }
          ]
        }]
      }
    });
  });

  it('splits comma-separated robustness strings into separate capabilities', () => {
    const keySystems = normalizeKeySystemsForEME({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        videoRobustness: 'HW_SECURE_DECODE, SW_SECURE_DECODE'
      }
    }, defaults);

    expect(keySystems?.['com.widevine.alpha']).toMatchObject({
      supportedConfigurations: [{
        videoCapabilities: [
          { contentType: 'video/mp4;codecs="avc1.42E01E"', robustness: 'HW_SECURE_DECODE' },
          { contentType: 'video/mp4;codecs="avc1.42E01E"', robustness: 'SW_SECURE_DECODE' }
        ]
      }]
    });
  });

  it('honors explicit content types over the defaults', () => {
    const keySystems = normalizeKeySystemsForEME({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        videoContentType: 'video/mp4;codecs="hvc1.1.6.L93.B0"',
        videoRobustness: 'HW_SECURE_DECODE'
      }
    }, defaults);

    expect(keySystems?.['com.widevine.alpha']).toMatchObject({
      supportedConfigurations: [{
        videoCapabilities: [
          { contentType: 'video/mp4;codecs="hvc1.1.6.L93.B0"', robustness: 'HW_SECURE_DECODE' }
        ]
      }]
    });
  });

  it('drops the robustness/content-type shorthands once encoded', () => {
    const config = normalizeKeySystemsForEME({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        audioRobustness: 'SW_SECURE_CRYPTO'
      }
    }, defaults)['com.widevine.alpha'];

    expect(config).not.toHaveProperty('audioRobustness');
    expect(config).not.toHaveProperty('videoRobustness');
    expect(config).not.toHaveProperty('audioContentType');
    expect(config).not.toHaveProperty('videoContentType');
  });

  it('passes FairPlay and pre-built supportedConfigurations through untouched', () => {
    const supportedConfigurations = [{
      videoCapabilities: [{ contentType: 'video/mp4;codecs="avc1.42E01E"' }]
    }];
    const keySystems = normalizeKeySystemsForEME({
      'com.apple.fps': {
        certificateUri: 'https://fps.example.com/cert',
        licenseUri: 'https://fps.example.com/license'
      },
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        supportedConfigurations
      }
    }, defaults);

    expect(keySystems).toEqual({
      'com.apple.fps': {
        certificateUri: 'https://fps.example.com/cert',
        licenseUri: 'https://fps.example.com/license'
      },
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        supportedConfigurations
      }
    });
  });
});
