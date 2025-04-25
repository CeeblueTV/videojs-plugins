import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import './plugin';
import { CeeblueVideoJSPlugin, type CeeblueVideoJSPluginOptions } from './ceeblue';
import 'videojs-contrib-quality-levels';

interface PlayerWithCeeblue extends Player {
  ceeblue: () => CeeblueVideoJSPlugin;
}

describe('CeeblueVideoJSPlugin', () => {
  let player: PlayerWithCeeblue;
  let videoElement: HTMLVideoElement;
  let plugin: CeeblueVideoJSPlugin;

  const testOptions: CeeblueVideoJSPluginOptions = {
    autoFallback: true,
    autoRetry: true,
    endPoint: 'fly.live.ceeblue.tv',
    streamName: 'out+de1e6f7c-e5db-450b-9603-c3644274779b',
    accessToken: '',
    protocols: ['hls']
  };

  beforeEach(() => {
    videoElement = document.createElement('video');
    videoElement.id = 'test-video';
    document.body.appendChild(videoElement);

    player = videojs(videoElement, {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      bigPlayButton: true,
      plugins: {
        ceeblue: testOptions
      }
    }) as PlayerWithCeeblue;

    plugin = player.ceeblue();
  });

  afterEach(() => {
    if (player) {
      player.dispose();
    }
    if (videoElement && videoElement.parentNode) {
      videoElement.parentNode.removeChild(videoElement);
    }
  });

  it('should initialize with correct version', () => {
    expect(CeeblueVideoJSPlugin.version).toBeDefined();
  });

  it('should have correct protocols', () => {
    expect(CeeblueVideoJSPlugin.protocols).toContain('webrtc');
    expect(CeeblueVideoJSPlugin.protocols).toContain('llhls');
    expect(CeeblueVideoJSPlugin.protocols).toContain('dash');
    expect(CeeblueVideoJSPlugin.protocols).toContain('hls');
  });

  it('should initialize with correct options', () => {
    expect(plugin).toBeDefined();
    expect(plugin.isQualityOptionsEnabled).toBe(true);
  });

  it('should handle errors and retry', async () => {
    player.trigger('error');

    await Promise.race([
      new Promise<void>((resolve) => {
        setTimeout(resolve, 2100);
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Error retry timeout')), 5000);
      })
    ]);

    expect(plugin.currentSource).toBeDefined();
  });

  it('should handle source switching by protocol', async () => {
    plugin.setSource({ protocol: 'hls' });

    await Promise.race([
      new Promise<void>((resolve) => {
        player.on('sourcechanged', () => {
          resolve();
        });
      }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Source switch timeout')), 5000);
      })
    ]);

    expect(plugin.currentSource?.sourceType).toBe('hls');
  });

  it('should start playing when play() is called after user interaction', async () => {
    await Promise.race([
      player.play(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Play timeout')), 5000);
      })
    ]);

    expect(player.paused()).toBe(false);
  });

  it('should receive video data when playing', async () => {
    await Promise.race([
      player.play(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Play timeout')), 60000);
      })
    ]);

    expect(player.readyState()).toBeGreaterThan(0);
    expect(player.currentTime()).toBeGreaterThanOrEqual(0);
  });

  it('should handle play/pause controls', async () => {
    await Promise.race([
      player.play(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Play timeout')), 60000);
      })
    ]);
    expect(player.paused()).toBe(false);

    player.pause();
    expect(player.paused()).toBe(true);

    await Promise.race([
      player.play(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Play timeout')), 60000);
      })
    ]);
    expect(player.paused()).toBe(false);
  });
});
