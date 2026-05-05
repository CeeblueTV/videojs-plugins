import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  let originalLoad: typeof HTMLMediaElement.prototype.load;
  let originalPlay: typeof HTMLMediaElement.prototype.play;
  let originalPause: typeof HTMLMediaElement.prototype.pause;
  let originalPaused: PropertyDescriptor | undefined;
  let originalReadyState: PropertyDescriptor | undefined;
  let originalCurrentTime: PropertyDescriptor | undefined;

  const testOptions: CeeblueVideoJSPluginOptions = {
    autoFallback: false,
    autoRetry: true,
    endPoint: 'fly.live.ceeblue.tv',
    streamName: 'out+de1e6f7c-e5db-450b-9603-c3644274779b',
    accessToken: '',
    protocols: ['hls']
  };

  const createPlayer = (options: CeeblueVideoJSPluginOptions = testOptions) => {
    player = videojs(videoElement, {
      autoplay: false,
      muted: true,
      controls: true,
      responsive: true,
      fluid: true,
      bigPlayButton: true,
      plugins: {
        ceeblue: options
      }
    }) as PlayerWithCeeblue;

    player.muted(true);
    plugin = player.ceeblue();
  };

  beforeEach(() => {
    originalLoad = HTMLMediaElement.prototype.load;
    originalPlay = HTMLMediaElement.prototype.play;
    originalPause = HTMLMediaElement.prototype.pause;
    originalPaused = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'paused');
    originalReadyState = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState');
    originalCurrentTime = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');

    HTMLMediaElement.prototype.load = function() {};
    HTMLMediaElement.prototype.play = function() {
      const media = this as HTMLMediaElement & {
        __mockPaused?: boolean;
        __mockReadyState?: number;
        __mockCurrentTime?: number;
      };

      media.__mockPaused = false;
      media.__mockReadyState = 4;
      media.__mockCurrentTime = Math.max(media.__mockCurrentTime ?? 0, 0.1);

      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function() {
      const media = this as HTMLMediaElement & {
        __mockPaused?: boolean;
      };

      media.__mockPaused = true;
    };

    Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { __mockPaused?: boolean }).__mockPaused ?? true;
      }
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { __mockReadyState?: number }).__mockReadyState ?? 0;
      }
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { __mockCurrentTime?: number }).__mockCurrentTime ?? 0;
      },
      set(value: number) {
        (this as HTMLMediaElement & { __mockCurrentTime?: number }).__mockCurrentTime = value;
      }
    });

    videoElement = document.createElement('video');
    videoElement.id = 'test-video';
    videoElement.muted = true;
    videoElement.defaultMuted = true;
    document.body.appendChild(videoElement);
    createPlayer();
  });

  afterEach(() => {
    HTMLMediaElement.prototype.load = originalLoad;
    HTMLMediaElement.prototype.play = originalPlay;
    HTMLMediaElement.prototype.pause = originalPause;

    if (originalPaused) {
      Object.defineProperty(HTMLMediaElement.prototype, 'paused', originalPaused);
    }
    if (originalReadyState) {
      Object.defineProperty(HTMLMediaElement.prototype, 'readyState', originalReadyState);
    }
    if (originalCurrentTime) {
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', originalCurrentTime);
    }

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
    const logErrorSpy = vi.spyOn(videojs.log, 'error').mockImplementation(() => {});

    player.dispose();
    createPlayer({
      ...testOptions,
      autoFallback: true
    });

    player.trigger('error');

    await withTimeout(new Promise<void>((resolve) => {
      setTimeout(resolve, 2100);
    }), 5000, 'Error retry timeout');

    expect(plugin.currentSource).toBeDefined();

    logErrorSpy.mockRestore();
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

  it('should replace options without recreating the player', async () => {
    const sourceChanged = new Promise<void>((resolve) => {
      player.one('sourcechanged', () => {
        resolve();
      });
    });

    plugin.replaceOptions({
      ...testOptions,
      protocols: ['dash', 'hls']
    });

    await withTimeout(sourceChanged, 5000, 'Options replace timeout');

    expect(plugin.currentSource?.sourceType).toBe('dash');
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

  it('should not resume fallback after stop interrupts an in-flight source change', async () => {
    let rejectPlay: ((error?: unknown) => void) | null = null;

    player.dispose();
    createPlayer({
      ...testOptions,
      protocols: ['webrtc', 'hls']
    });

    const playSpy = vi.spyOn(player, 'play').mockImplementation(() => {
      return new Promise((_, reject) => {
        rejectPlay = reject;
      });
    });
    const scheduleRetrySpy = vi.spyOn(plugin as never as { _scheduleRetry: () => void }, '_scheduleRetry');

    player.autoplay(true);
    plugin.setSource(0);
    plugin.stop();
    rejectPlay?.(new DOMException('The play() request was interrupted by a call to pause().', 'AbortError'));
    await Promise.resolve();
    await Promise.resolve();

    expect(scheduleRetrySpy).not.toHaveBeenCalled();
    expect(playSpy).toHaveBeenCalled();

    playSpy.mockRestore();
    scheduleRetrySpy.mockRestore();
  });

  it('should stop fallback after the configured number of full source loops', () => {
    player.dispose();
    createPlayer({
      ...testOptions,
      autoFallback: true,
      maxRetries: 2,
      protocols: ['wrts', 'webrtc', 'llhls', 'hls', 'dash']
    });

    const setSourceSpy = vi.spyOn(plugin as never as { _setSource: (source: unknown) => void }, '_setSource')
      .mockImplementation(() => undefined);
    const stopSpy = vi.spyOn(plugin, 'stop');

    plugin._trySource();
    plugin._trySource();
    plugin._trySource();
    plugin._trySource();
    plugin._trySource();
    plugin._trySource();
    plugin._trySource();
    plugin._trySource();
    plugin._trySource();
    plugin._trySource();

    expect(setSourceSpy).toHaveBeenCalledTimes(9);
    expect(stopSpy).toHaveBeenCalledTimes(1);

    setSourceSpy.mockRestore();
    stopSpy.mockRestore();
  });

  it('should retry indefinitely when maxRetries is 0', () => {
    player.dispose();
    createPlayer({
      ...testOptions,
      autoFallback: true,
      maxRetries: 0,
      protocols: ['wrts', 'webrtc']
    });

    const setSourceSpy = vi.spyOn(plugin as never as { _setSource: (source: unknown) => void }, '_setSource')
      .mockImplementation(() => undefined);
    const stopSpy = vi.spyOn(plugin, 'stop');

    plugin._trySource();
    plugin._trySource();
    plugin._trySource();
    plugin._trySource();
    plugin._trySource();

    expect(setSourceSpy).toHaveBeenCalledTimes(5);
    expect(stopSpy).not.toHaveBeenCalled();

    setSourceSpy.mockRestore();
    stopSpy.mockRestore();
  });

  it('should emit sourcechanged with no source when stop is called', () => {
    const sourceChangedSpy = vi.fn();

    player.on('sourcechanged', sourceChangedSpy);
    plugin.stop();

    expect(sourceChangedSpy).toHaveBeenCalledTimes(1);
    expect(sourceChangedSpy.mock.calls[0]?.[0]?.details?.source).toBeUndefined();
  });

  it('should ignore pre-init contrib-eme functions on stop', () => {
    const eme = vi.fn() as typeof player.eme & {
      activeSrc?: string | null;
      sessions?: unknown[];
    };

    eme.activeSrc = 'https://example.test/drm.m3u8';
    eme.sessions = [{ sessionId: '1' }];
    player.eme = eme;

    plugin.stop();

    expect(eme.activeSrc).toBe('https://example.test/drm.m3u8');
    expect(eme.sessions).toEqual([{ sessionId: '1' }]);
  });

  it('should clear contrib-eme runtime state on stop after eme initialization', () => {
    player.eme = {
      activeSrc: 'https://example.test/drm.m3u8',
      sessions: [{ sessionId: '1' }]
    };

    plugin.stop();

    expect(player.eme?.activeSrc).toBeNull();
    expect(player.eme?.sessions).toEqual([]);
  });

  it('should stop safely when contrib-eme is unavailable', () => {
    player.eme = undefined;

    expect(() => plugin.stop()).not.toThrow();
  });
});
