import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import './plugin';
import { CeeblueVideoJSPlugin, type CeeblueVideoJSPluginOptions } from './ceeblue';

interface PlayerWithCeeblue extends Player {
  ceeblue: () => CeeblueVideoJSPlugin;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
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
    videoElement.muted = true;
    videoElement.defaultMuted = true;
    document.body.appendChild(videoElement);

    player = videojs(videoElement, {
      autoplay: false,
      muted: true,
      controls: true,
      responsive: true,
      fluid: true,
      bigPlayButton: true,
      plugins: {
        ceeblue: testOptions
      }
    }) as PlayerWithCeeblue;

    player.muted(true);
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
    expect(CeeblueVideoJSPlugin.protocols).toContain('wrts');
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

    await withTimeout(new Promise<void>((resolve) => {
      setTimeout(resolve, 2100);
    }), 5000, 'Error retry timeout');

    expect(plugin.currentSource).toBeDefined();
  });

  it('should handle source switching by protocol', async () => {
    const sourceChanged = new Promise<void>((resolve) => {
      player.one('sourcechanged', () => {
        resolve();
      });
    });

    plugin.setSource({ protocol: 'hls' });

    await withTimeout(sourceChanged, 5000, 'Source switch timeout');

    expect(plugin.currentSource?.sourceType).toBe('hls');
  });

  it('should start playing when play() is called after user interaction', async () => {
    await withTimeout(player.play(), 5000, 'Play timeout');

    expect(player.paused()).toBe(false);
  });

  it('should receive video data when playing', async () => {
    await withTimeout(player.play(), 60000, 'Play timeout');

    expect(player.readyState()).toBeGreaterThan(0);
    expect(player.currentTime()).toBeGreaterThanOrEqual(0);
  });

  it('should handle play/pause controls', async () => {
    await withTimeout(player.play(), 60000, 'Play timeout');
    expect(player.paused()).toBe(false);

    player.pause();
    expect(player.paused()).toBe(true);

    await withTimeout(player.play(), 60000, 'Play timeout');
    expect(player.paused()).toBe(false);
  });
});
