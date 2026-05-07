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

  it('should show the active quality in the button label and fall back to the icon otherwise', () => {
    player.qualityButton();
    const qualityLevels = player.qualityLevels();

    expect(qualityLevels).toBeDefined();

    // @ts-expect-error - controlBar type is missing.
    const qualityButton = player.controlBar.getChild('QualityMenuButton');
    const buttonEl = qualityButton?.el();

    expect(buttonEl?.classList.contains('vjs-quality-button--has-label')).toBe(false);
    expect(buttonEl?.querySelector('.vjs-quality-button-label')?.textContent).toBe('');

    qualityLevels?.addQualityLevel({
      id: 'high',
      width: 1280,
      height: 720,
      bandwidth: 3000000,
      enabled: () => true
    });

    qualityLevels?.addQualityLevel({
      id: 'low',
      width: 854,
      height: 480,
      bandwidth: 1200000,
      enabled: () => true
    });

    if (qualityLevels) {
      qualityLevels.selectedIndex_ = 0;
      qualityLevels.trigger({ selectedIndex: qualityLevels.selectedIndex_, type: 'change' });
    }

    expect(buttonEl?.classList.contains('vjs-quality-button--has-label')).toBe(true);
    expect(buttonEl?.querySelector('.vjs-quality-button-label')?.textContent).toBe('720p');
  });
});
