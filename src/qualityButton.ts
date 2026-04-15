import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type PluginType from 'video.js/dist/types/plugin';
import type QualityLevelList from 'videojs-contrib-quality-levels/dist/types/quality-level-list';
import type { QualityMenuButton } from './components/QualityMenuButton';
import './components/QualityMenuButton';
import './registerQualityLevels';

const Plugin = videojs.getPlugin('plugin') as unknown as typeof PluginType;

type PlayerWithQualityLevels = Player & {
  qualityLevels?: () => QualityLevelList | undefined;
};

export class QualityButtonPlugin extends Plugin {
  private _player!: PlayerWithQualityLevels;
  private _qualityButton?: QualityMenuButton | void;

  constructor(player: Player) {
    super(player);
    this._player = player as PlayerWithQualityLevels;
    this.update();
  }

  update() {
    if (typeof this._player.qualityLevels !== 'function') {
      this._player.log.warn('Quality levels plugin not found. Please ensure videojs-contrib-quality-levels is loaded.');
      return;
    }

    const qualityLevels = this._player.qualityLevels();

    if (!qualityLevels) {
      this._player.log.warn('Failed to initialize quality levels');
      return;
    }

    // @ts-expect-error - controlBar type is missing.
    const controlBar = this._player.controlBar;

    if (!controlBar) {
      this._player.log.warn('player.controlBar is not available, skipping quality button');
      return;
    }

    if (this._qualityButton) {
      controlBar.removeChild(this._qualityButton);
      this._qualityButton = undefined;
    }

    const qualityButtonOptions = {
      title: 'Quality',
      qualities: qualityLevels,
      buttonClass: 'vjs-video-button'
    };
    const audioTrackButton = controlBar.getChild('audioTrackButton');

    if (audioTrackButton) {
      const audioTrackIndex = controlBar.children().indexOf(audioTrackButton);

      this._qualityButton = controlBar.addChild('QualityMenuButton', qualityButtonOptions, audioTrackIndex) as unknown as QualityMenuButton;
    } else {
      this._qualityButton = controlBar.addChild('QualityMenuButton', qualityButtonOptions) as unknown as QualityMenuButton;
    }

    this._qualityButton.update();
  }

  dispose() {
    // @ts-expect-error - controlBar type is missing.
    const controlBar = this._player.controlBar;

    if (controlBar && this._qualityButton) {
      controlBar.removeChild(this._qualityButton);
      this._qualityButton = undefined;
    }

    super.dispose();
  }
}

export default QualityButtonPlugin;
