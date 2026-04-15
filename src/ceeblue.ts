import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type PluginType from 'video.js/dist/types/plugin';
import { expandSourcesToVideoJSSources, protocols, type CeeblueSourcesOptions, type VideojsSourceObject} from './sources/sources';
import type QualityLevelList from 'videojs-contrib-quality-levels/dist/types/quality-level-list';
import type { Event } from 'video.js/dist/types/event-target';
import type { QualityButtonPlugin } from './qualityButton';

const Plugin = videojs.getPlugin('plugin') as unknown as typeof PluginType;

// Extend the Player type to include qualityLevels
type PlayerWithQualityLevels = Player & {
  qualityLevels: () => QualityLevelList | undefined;
  qualityButton?: () => QualityButtonPlugin;
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

  private _retryCount: number = 0;
  private _maxRetries: number = 3;
  private _gracePeriod: number = 2000;
  private _retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private _suspendFallback = false;

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
    this._suspendFallback = true;

    try {
      // Pause the player
      this._player.pause();

      // Reset the player state
      this._player.reset();

      // Set the new source
      this._player.src(source);

      // Handle source change event
      this._handleSourceChanged(source);

      // Try to play the new source
      await this._player.play();
    } catch {
      // If play fails, try the next source after grace period
      if (this._options.autoFallback) {
        this._scheduleRetry();
      }
    } finally {
      setTimeout(() => {
        this._suspendFallback = false;
      }, 0);
    }
  }

  /**
   * Reset VideoJS player state.
   */
  _reset() {
    this._suspendFallback = true;

    // reset VideoJS state.
    this._player.pause();
    this._player.reset();
    this._player.error(null);
    this._handleSourceChanged();

    setTimeout(() => {
      this._suspendFallback = false;
    }, 0);
  }

  /**
   * Handle videojs error event
   * @param  _ the error event
   * @param error the error message
   */
  _handleError(_: Event, error: unknown) {
    if (this._suspendFallback) {
      return;
    }

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
    if (this._suspendFallback) {
      return;
    }

    // If auto fallback is enabled, try the next source
    if (this._options.autoFallback) {
      this._trySource();
    }
  }

  /**
   * Handle loaded metadata callback.
   */
  private _handleLoadedMetadata() {
    if (!this.isQualityOptionsEnabled) {
      return;
    }

    // Delay slightly so VHS/WebRTC quality levels have time to populate.
    setTimeout(() => {
      this._player.qualityButton?.().update();
    }, 500);
  }

  /**
   * Event triggered when the source changes.
   *
   * @param source the source to play or null if no more source is available
   */
  _handleSourceChanged(source?: VideojsSourceObject) {
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

  stop() {
    if (this._retryTimeout) {
      clearTimeout(this._retryTimeout);
      this._retryTimeout = null;
    }

    this._retryCount = 0;
    this._reset();
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
