import { describe, it, expect } from 'vitest';
import {
  protocols,
  CeeblueCloudSource,
  CeeblueAutoURLSource,
  expandSourcesToVideoJSSources,
  determineSourceTypeFromURL
} from './sources';

describe('sources', () => {
  describe('protocols', () => {
    it('should contain all supported protocols', () => {
      expect(protocols).toEqual(['wrts', 'webrtc', 'llhls', 'hls', 'dash']);
    });
  });

  describe('determineSourceTypeFromURL', () => {
    it('should return undefined for invalid URLs', () => {
      expect(determineSourceTypeFromURL('invalid-url')).toBeUndefined();
    });

    it('should detect WebRTC signaling URLs', () => {
      const result = determineSourceTypeFromURL('wss://example.com/signaling');

      expect(result).toEqual({
        type: 'application/x-ceeblue-webrtc-signaling',
        sourceType: 'webrtc'
      });
    });

    it('should detect WebRTC SDP URLs', () => {
      const result = determineSourceTypeFromURL('https://example.com/webrtc/stream');

      expect(result).toEqual({
        type: 'application/sdp',
        sourceType: 'webrtc'
      });
    });

    it('should detect WRTS URLs', () => {
      const result = determineSourceTypeFromURL('https://example.com/wrts/stream/index.json');

      expect(result).toEqual({
        type: 'application/json',
        sourceType: 'wrts'
      });
    });

    it('should detect HLS URLs', () => {
      const result = determineSourceTypeFromURL('https://example.com/stream/index.m3u8');

      expect(result).toEqual({
        type: 'application/vnd.apple.mpegurl',
        sourceType: 'hls'
      });
    });

    it('should detect DASH URLs', () => {
      const result = determineSourceTypeFromURL('https://example.com/stream/index.mpd');

      expect(result).toEqual({
        type: 'application/dash+xml',
        sourceType: 'dash'
      });
    });
  });

  describe('expandSourcesToVideoJSSources', () => {
    const keySystems = {
      'com.widevine.alpha': 'https://widevine.example.com',
      'com.apple.fps': {
        certificateUri: 'https://fps.example.com/cert',
        licenseUri: 'https://fps.example.com/license'
      }
    };

    it('should expand single Cloud source with default protocols', () => {
      const source: CeeblueCloudSource = {
        endPoint: 'example.com',
        streamName: 'test-stream'
      };

      const result = expandSourcesToVideoJSSources(source);

      // wrts, webrtc, llhls, hls, dash.
      expect(result).toHaveLength(5);
      expect(result[0]?.sourceType).toBe('wrts');
      expect(result[1]?.sourceType).toBe('webrtc');
      expect(result[2]?.sourceType).toBe('llhls');
      expect(result[3]?.sourceType).toBe('hls');
      expect(result[4]?.sourceType).toBe('dash');
    });

    it('should expand single Cloud source with specific protocols', () => {
      const source: CeeblueCloudSource = {
        endPoint: 'example.com',
        streamName: 'test-stream',
        protocols: ['webrtc', 'hls']
      };

      const result = expandSourcesToVideoJSSources(source);

      expect(result).toHaveLength(2);
      expect(result[0]?.sourceType).toBe('webrtc');
      expect(result[1]?.sourceType).toBe('hls');
    });

    it('should expand single URL source', () => {
      const source: CeeblueAutoURLSource = {
        url: 'https://example.com/stream.m3u8',
        mimeType: 'application/vnd.apple.mpegurl'
      };

      const result = expandSourcesToVideoJSSources(source);

      expect(result).toHaveLength(1);
      expect(result[0]?.src).toBe(source.url);
      expect(result[0]?.type).toBe(source.mimeType);
    });

    it('should pass DRM keySystems through HTTP URL sources', () => {
      const result = expandSourcesToVideoJSSources({
        url: 'https://example.com/stream.mpd',
        type: 'dash',
        keySystems
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        src: 'https://example.com/stream.mpd',
        sourceType: 'dash',
        keySystems
      });
    });

    it('should add DRM keySystems to Cloud HLS and DASH sources', () => {
      const result = expandSourcesToVideoJSSources({
        endPoint: 'example.com',
        streamName: 'test-stream',
        protocols: ['hls', 'dash'],
        settings: {
          hls: {
            keySystems
          },
          dash: {
            keySystems: {
              'com.microsoft.playready': 'https://playready.example.com'
            }
          }
        }
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        sourceType: 'hls',
        keySystems
      });
      expect(result[1]).toMatchObject({
        sourceType: 'dash',
        keySystems: {
          'com.microsoft.playready': 'https://playready.example.com'
        }
      });
    });

    it('should merge top-level settings into Cloud sources', () => {
      const result = expandSourcesToVideoJSSources({
        settings: {
          hls: {
            keySystems
          }
        },
        sources: [
          {
            endPoint: 'example.com',
            streamName: 'stream-a',
            protocols: ['hls']
          },
          {
            endPoint: 'example.com',
            streamName: 'stream-b',
            protocols: ['hls'],
            settings: {
              hls: {
                format: 'ts'
              }
            }
          }
        ]
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        sourceType: 'hls',
        keySystems
      });
      expect(result[1]).toMatchObject({
        sourceType: 'hls',
        keySystems
      });
      expect(result[1]?.src).toContain('/ts/stream-b/');
    });
  });
});
