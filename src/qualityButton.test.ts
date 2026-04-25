import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import './plugin';
import { QualityButtonPlugin } from './qualityButton';

interface PlayerWithQualityButton extends Player {
  qualityButton: () => QualityButtonPlugin;
}

describe('QualityButtonPlugin', () => {
  let player: PlayerWithQualityButton;
  let videoElement: HTMLVideoElement;
  let originalLoad: typeof HTMLMediaElement.prototype.load;

  beforeEach(() => {
    originalLoad = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function() {};
  });

  beforeEach(() => {
    videoElement = document.createElement('video');
    videoElement.id = 'test-quality-button-video';
    document.body.appendChild(videoElement);

    player = videojs(videoElement, {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      bigPlayButton: true
    }) as PlayerWithQualityButton;
  });

  afterEach(() => {
    HTMLMediaElement.prototype.load = originalLoad;

    if (player) {
      player.dispose();
    }
    if (videoElement && videoElement.parentNode) {
      videoElement.parentNode.removeChild(videoElement);
    }
  });

  it('should initialize as a standalone plugin', () => {
    const plugin = player.qualityButton();

    expect(plugin).toBeDefined();
    // @ts-expect-error - controlBar type is missing.
    expect(player.controlBar.getChild('QualityMenuButton')).toBeDefined();
  });
});
