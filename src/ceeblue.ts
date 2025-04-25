import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type PluginType from 'video.js/dist/types/plugin';
import { expandSourcesToVideoJSSources, protocols, type CeeblueSourcesOptions, type VideojsSourceObject} from './sources/sources';
import { QualityMenuButton } from './components/QualityMenuButton';
import type QualityLevelList from 'videojs-contrib-quality-levels/dist/types/quality-level-list';
import type { Event } from 'video.js/dist/types/event-target';

const Plugin = videojs.getPlugin('plugin') as unknown as typeof PluginType;

// Extend the Player type to include qualityLevels
type PlayerWithQualityLevels = Player & {
  qualityLevels: () => QualityLevelList | undefined;
};

// Replaced with the plugin's version during the build process.
const __libVersion__ = '?';

export type CeeblueVideoJSPluginOptions = CeeblueSourcesOptions & {
  /**
   * Determines if quality options should be enabled in the UI.
   *
   * @default true
   */
  enableQualityOptions?: boolean;
  /**
   * Determines if auto fallback should be enabled.
   *
   * @default true
   */
  autoFallback?: boolean;
  /**
   * Maximum number of retry attempts for each protocol before moving to the next one.
   *
   * @default 3
   */
  maxRetries?: number;
  /**
   * Grace period in milliseconds before trying a new source.
   *
   * @default 2000
   */
  gracePeriod?: number;
};

export class CeeblueVideoJSPlugin extends Plugin {
  /**
   * The plugin version.
   */
  static version = __libVersion__;

  /**
   * The list of supported protocols.
   */
  static get protocols() {
    return [...protocols];
  }

  /**
   * Whether if the quality options are enabled.
   *
   * @default true
   */
  get isQualityOptionsEnabled() {
    if (typeof this._options.enableQualityOptions === 'boolean') {
      return this._options.enableQualityOptions;
    }

    return true;
  }

  set isQualityOptionsEnabled(value: boolean) {
    this._options.enableQualityOptions = !!value;
  }

  /**
   * The player instance.
   */
  private _player!: PlayerWithQualityLevels;

  /**
   * Current source controller options.
   */
  private _options: CeeblueVideoJSPluginOptions;

  /**
   * Videojs sources.
   */
  private _sources: VideojsSourceObject[] = [];
  private _currentSourceIndex: number = 0;

  /**
   * The quality buttons components if enabled.
   */
  private _qualityButton?: QualityMenuButton | void;

  private _retryCount: number = 0;
  private _maxRetries: number = 3;
  private _gracePeriod: number = 2000;
  private _retryTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * SourceController constructor
   *
   * @param player Videojs player instance
   * @param options The source controller options.
   */
  constructor(player: Player, options: CeeblueVideoJSPluginOptions) {
    super(player);
    player.addClass('vjs-ceeblue');

    this._player = player as PlayerWithQualityLevels;
    this._options = options;
    this._maxRetries = options.maxRetries ?? 3;
    this._gracePeriod = options.gracePeriod ?? 2000;

    const sources = expandSourcesToVideoJSSources(options);

    if (!sources.length) {
      throw new Error('Expected at least one source');
    }

    this._sources = sources;
    this._currentSourceIndex = 0;
    this._player.src(this._sources[0]);

    player.ready(this._handleReady.bind(this));
    player.on('error', this._handleError.bind(this));
    player.on('ended', this._handleEnded.bind(this));
    player.on('loadedmetadata', this._handleLoadedMetadata.bind(this));
  }

  /**
   * Replace the current sources with the given options.
   *
   * @param options
   */
  replaceOptions(options: CeeblueVideoJSPluginOptions) {
    const sources = expandSourcesToVideoJSSources(options);

    if (!sources.length) {
      throw new Error('Expected at least one source');
    }

    this._sources = sources;
    this._options = options;
  }

  /**
   * Get the current source being played.
   */
  get currentSource(): VideojsSourceObject | null {
    return this._sources[this._currentSourceIndex] || null;
  }

  /**
   * Get the list of available protocols.
   */
  get availableProtocols(): string[] {
    return [...new Set(this._sources.map(source => source.sourceType || ''))].filter(Boolean);
  }

  /**
   * Safely change the player source with proper pause and reset.
   * @param source The source to set
   */
  private async _setSource(source: VideojsSourceObject) {
    try {
      // Pause the player
      this._player.pause();

      // Reset the player state
      this._player.reset();

      // Set the new source
      this._player.src(source);

      // Handle source change event
      this._handleSourceChanged(source.src);

      // Try to play the new source
      await this._player.play();
    } catch {
      // If play fails, try the next source after grace period
      if (this._options.autoFallback) {
        this._scheduleRetry();
      }
    }
  }

  /**
   * Creates and adds the quality controller button the control bar.
   */
  _addQualityButton() {
    // Ensure quality levels plugin is available
    if (typeof this._player.qualityLevels !== 'function') {
      this._player.log.warn('Quality levels plugin not found. Please ensure videojs-contrib-quality-levels is loaded.');
      return;
    }

    // Initialize quality levels if not already done
    const qualityLevels = this._player.qualityLevels();

    if (!qualityLevels) {
      this._player.log.warn('Failed to initialize quality levels');
      return;
    }

    // @ts-expect-error - controlBar type is missing.
    const controlBar = this._player.controlBar;

    if (!controlBar) {
      this._player.log.warn('player.controlBar is not available, Skipping adding quality button');
      return;
    }

    // Remove existing quality button if any
    if (this._qualityButton) {
      controlBar.removeChild(this._qualityButton);
      this._qualityButton = undefined;
    }

    this._qualityButton = new QualityMenuButton(this._player, {
      title: 'Quality',
      qualities: qualityLevels,
      buttonClass: 'vjs-video-button'
    });

    // Add the button before the audio track button if it exists, otherwise add it to the end
    const audioTrackButton = controlBar.getChild('audioTrackButton');

    if (audioTrackButton) {
      controlBar.el().insertBefore(
        controlBar.addChild(this._qualityButton).el(),
        audioTrackButton.el()
      );
    } else {
      controlBar.addChild(this._qualityButton);
    }

    // Force an update of the quality menu
    this._qualityButton.update();
  }

  /**
   * Handle Player ready callback.
   */
  private _handleReady() {
    if (this.isQualityOptionsEnabled) {
      // Add quality button after player is ready and metadata is loaded
      this._player.one('loadedmetadata', () => {
        // Add a small delay to ensure quality levels are populated
        setTimeout(() => {
          this._addQualityButton();
        }, 500);
      });
    }
  }

  /**
   * Reset VideoJS player state.
   */
  _reset() {
    // reset VideoJS state.
    this._player.pause();
    this._player.reset();
  }

  /**
   * Handle videojs error event
   * @param  _ the error event
   * @param error the error message
   */
  _handleError(_: Event, error: unknown) {
    if (!error) {
      error = this._player.error()?.message;
    }

    // If auto fallback is enabled, try the next source
    if (this._options.autoFallback) {
      this._trySource();
    }
  }

  /**
   * Handle videojs ended event.
   */
  _handleEnded() {
    // If auto fallback is enabled, try the next source
    if (this._options.autoFallback) {
      this._trySource();
    }
  }

  /**
   * Handle loaded metadata callback.
   */
  private _handleLoadedMetadata() {
    // Quality button is now added in _handleReady
  }

  /**
   * Event triggered when the source changes.
   *
   * @param source the source to play or null if no more source is available
   */
  _handleSourceChanged(source?: string) {
    this._player.trigger({
      type: 'sourcechanged',
      details: { source }
    });
  }

  /**
   * Try the next source or ends if no more source is available.
   */
  _trySource() {
    if (!this._sources.length) {
      return;
    }

    const currentSource = this._sources[this._currentSourceIndex];

    if (!currentSource) {
      return;
    }

    // If we haven't exceeded max retries for current source, try again
    if (this._retryCount < this._maxRetries) {
      this._retryCount++;
      this._setSource(currentSource);
      return;
    }

    // Reset retry count and move to next source
    this._retryCount = 0;
    this._currentSourceIndex++;

    if (this._currentSourceIndex < this._sources.length) {
      const nextSource = this._sources[this._currentSourceIndex];

      if (!nextSource) {
        return;
      }

      this._setSource(nextSource);
    } else {
      // Reset to first source if we've tried all sources
      this._currentSourceIndex = 0;
      const firstSource = this._sources[0];

      if (!firstSource) {
        return;
      }

      this._setSource(firstSource);
    }
  }

  /**
   * Schedule a retry after the grace period
   */
  private _scheduleRetry() {
    if (this._retryTimeout) {
      clearTimeout(this._retryTimeout);
    }
    this._retryTimeout = setTimeout(() => {
      this._trySource();
    }, this._gracePeriod);
  }

  /**
   * Set the current source by protocol.
   * @param options Object with protocol to set
   */
  setSource(options: { protocol: string } | number) {
    let index: number;

    if (typeof options === 'number') {
      index = options;
    } else {
      index = this._sources.findIndex(source => source.sourceType === options.protocol);
    }

    const source = this._sources[index];

    if (!source) {
      if (typeof options === 'number') {
        throw new Error(`Source with index ${options} not found`);
      }

      throw new Error(`Source with protocol ${options.protocol} not found`);
    }

    this._currentSourceIndex = index;

    this._setSource(source);
  }

  /**
   * Clean up any pending timeouts
   */
  override dispose() {
    if (this._retryTimeout) {
      clearTimeout(this._retryTimeout);
    }
    super.dispose();
  }
}
