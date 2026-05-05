import { describe, expect, it } from 'vitest';
import { Metadata } from '@ceeblue/wrts-client';
import { enrichWRTSKeySystemsWithMetadata } from './WRTSDRM';

describe('enrichWRTSKeySystemsWithMetadata', () => {
  const metadata = new Metadata({
    tracks: [
      {
        id: 1,
        type: 'audio',
        codec: 'mp4a.40.2',
        config: '',
        contentProtection: 'd046a1fcfa495133a60aaca985c3204b'
      },
      {
        id: 4,
        type: 'video',
        codec: 'avc1.64001f',
        config: '',
        contentProtection: 'd046a1fcfa495133a60aaca985c3204b'
      }
    ],
    contentProtection: [
      {
        kid: 'd046a1fcfa495133a60aaca985c3204b',
        scheme: 'cenc',
        pssh: {
          'edef8ba979d64acea3c827dcd51d21ed': 'AAAAP3Bzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB8='
        }
      }
    ]
  });

  it('normalizes string-based Widevine and PlayReady configs to supportedConfigurations', () => {
    const keySystems = enrichWRTSKeySystemsWithMetadata({
      'com.widevine.alpha': 'https://widevine.example.com',
      'com.microsoft.playready': 'https://playready.example.com'
    }, metadata);

    expect(keySystems).toMatchObject({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        supportedConfigurations: [{
          audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
          videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.64001f"' }]
        }],
        pssh: expect.any(Uint8Array)
      },
      'com.microsoft.playready': {
        url: 'https://playready.example.com',
        supportedConfigurations: [{
          audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
          videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.64001f"' }]
        }]
      }
    });
  });

  it('keeps supportedConfigurations, adds pssh when available, and leaves FairPlay as-is', () => {
    const supportedConfigurations = [{
      audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
      videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.64001f"' }]
    }];
    const keySystems = enrichWRTSKeySystemsWithMetadata({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        supportedConfigurations
      },
      'com.apple.fps': {
        certificateUri: 'https://fps.example.com/cert',
        licenseUri: 'https://fps.example.com/license'
      }
    }, metadata);

    expect(keySystems).toMatchObject({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        supportedConfigurations,
        pssh: expect.any(Uint8Array)
      },
      'com.apple.fps': {
        certificateUri: 'https://fps.example.com/cert',
        licenseUri: 'https://fps.example.com/license'
      }
    });
  });

  it('converts object configs without supportedConfigurations to the same supportedConfigurations flow', () => {
    const keySystems = enrichWRTSKeySystemsWithMetadata({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        audioContentType: 'audio/mp4; codecs="mp4a.40.2"',
        videoContentType: 'video/mp4; codecs="avc1.64001f"',
        audioRobustness: 'SW_SECURE_CRYPTO',
        videoRobustness: 'SW_SECURE_DECODE'
      }
    }, metadata);

    expect(keySystems).toMatchObject({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        pssh: expect.any(Uint8Array),
        supportedConfigurations: [{
          audioCapabilities: [{
            contentType: 'audio/mp4; codecs="mp4a.40.2"',
            robustness: 'SW_SECURE_CRYPTO'
          }],
          videoCapabilities: [{
            contentType: 'video/mp4; codecs="avc1.64001f"',
            robustness: 'SW_SECURE_DECODE'
          }]
        }]
      }
    });

    expect(keySystems?.['com.widevine.alpha']).not.toHaveProperty('audioContentType');
    expect(keySystems?.['com.widevine.alpha']).not.toHaveProperty('videoContentType');
  });

  it('uses supportedConfigurations when metadata exposes multiple encrypted video codecs', () => {
    const multiCodecMetadata = new Metadata({
      tracks: [
        {
          id: 1,
          type: 'audio',
          codec: 'mp4a.40.2',
          config: '',
          contentProtection: 'd046a1fcfa495133a60aaca985c3204b'
        },
        {
          id: 4,
          type: 'video',
          codec: 'avc1.640028',
          config: '',
          contentProtection: 'd046a1fcfa495133a60aaca985c3204b'
        },
        {
          id: 5,
          type: 'video',
          codec: 'avc1.64001f',
          config: '',
          contentProtection: 'd046a1fcfa495133a60aaca985c3204b'
        }
      ],
      contentProtection: [
        {
          kid: 'd046a1fcfa495133a60aaca985c3204b',
          scheme: 'cenc',
          pssh: {
            'edef8ba979d64acea3c827dcd51d21ed': 'AAAAP3Bzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB8='
          }
        }
      ]
    });

    const keySystems = enrichWRTSKeySystemsWithMetadata({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        audioRobustness: 'SW_SECURE_CRYPTO',
        videoRobustness: 'SW_SECURE_DECODE'
      }
    }, multiCodecMetadata);

    expect(keySystems).toMatchObject({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        pssh: expect.any(Uint8Array),
        supportedConfigurations: [{
          audioCapabilities: [{
            contentType: 'audio/mp4; codecs="mp4a.40.2"',
            robustness: 'SW_SECURE_CRYPTO'
          }],
          videoCapabilities: [
            {
              contentType: 'video/mp4; codecs="avc1.640028"',
              robustness: 'SW_SECURE_DECODE'
            },
            {
              contentType: 'video/mp4; codecs="avc1.64001f"',
              robustness: 'SW_SECURE_DECODE'
            }
          ]
        }]
      }
    });

    expect(keySystems?.['com.widevine.alpha']).not.toHaveProperty('videoContentType');
  });
});
