import { describe, expect, it } from 'vitest';
import { Metadata } from '@ceeblue/wrts-client';
import { enrichWRTSKeySystemsWithMetadata } from './WRTSSource';

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

  it('adds content types to string-based Widevine and PlayReady configs', () => {
    const keySystems = enrichWRTSKeySystemsWithMetadata({
      'com.widevine.alpha': 'https://widevine.example.com',
      'com.microsoft.playready': 'https://playready.example.com'
    }, metadata);

    expect(keySystems).toMatchObject({
      'com.widevine.alpha': {
        url: 'https://widevine.example.com',
        audioContentType: 'audio/mp4; codecs="mp4a.40.2"',
        videoContentType: 'video/mp4; codecs="avc1.64001f"',
        pssh: expect.any(Uint8Array)
      },
      'com.microsoft.playready': {
        url: 'https://playready.example.com',
        audioContentType: 'audio/mp4; codecs="mp4a.40.2"',
        videoContentType: 'video/mp4; codecs="avc1.64001f"'
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
});
