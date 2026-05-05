import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type PluginType from 'video.js/dist/types/plugin';
import { expandSourcesToVideoJSSources, protocols, type CeeblueSourcesOptions, type VideojsSourceObject} from './sources/sources';
import type QualityLevelList from 'videojs-contrib-quality-levels/dist/types/quality-level-list';
import type { Event } from 'video.js/dist/types/event-target';
import type { QualityButtonPlugin } from './qualityButton';

const Plugin = videojs.getPlugin('plugin') as unknown as typeof PluginType;

type EMEPluginState = {
  activeSrc?: string | null;
  sessions?: unknown[];
};

// Extend the Player type to include qualityLevels
type PlayerWithQualityLevels = Player & {
  qualityLevels: () => QualityLevelList | undefined;
  qualityButton?: () => QualityButtonPlugin;
  eme?: (((options?: Record<string, unknown>) => void) & EMEPluginState) | EMEPluginState;
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
   * Maximum number of full source-list loops before stopping fallback.
   * A value of 0 means retry indefinitely.
   *
   * @default 0
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

  private _completedLoopCount: number = 0;
  private _retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private _qualityUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  private _suspendFallback = false;
  private _isStopped = false;
  private _sourceRequestId = 0;

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
    this._setOptions(options);
    this._currentSourceIndex = 0;

    player.on('error', this._handleError.bind(this));
    player.on('ended', this._handleEnded.bind(this));
    player.on('loadedmetadata', this._handleLoadedMetadata.bind(this));

    // Use the same guarded startup path as later source switches, but delay
    // slightly so listeners registered right after player creation can still
    // observe the initial sourcechanged event.
    setTimeout(() => {
      if (this._player.isDisposed() || this._isStopped) {
        return;
      }

      const source = this._sources[this._currentSourceIndex];

      if (!source) {
        return;
      }

      void this._setSource(source);
    }, 0);
  }

  /**
   * Apply options to the internal source list and runtime settings.
   */
  private _setOptions(options: CeeblueVideoJSPluginOptions) {
    const sources = expandSourcesToVideoJSSources(options);

    if (!sources.length) {
      throw new Error('Expected at least one source');
    }

    this._options = options;
    this._sources = sources;
  }

  /**
   * Get the current source being played.
   */
  get currentSource(): VideojsSourceObject | null {
    return this._sources[this._currentSourceIndex] || null;
  }

  private get _maxRetries() {
    return this._options.maxRetries ?? 0;
  }

  private get _gracePeriod() {
    return this._options.gracePeriod ?? 2000;
  }

  private _fallbackBlocked() {
    return this._suspendFallback || this._isStopped;
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
    const requestId = ++this._sourceRequestId;

    this._isStopped = false;
    this._suspendFallback = true;
    this._clearRetryTimeout();
    const shouldResumePlayback = !this._player.paused() || !!this._player.autoplay();

    try {
      if (!this._isRequestActive(requestId)) {
        return;
      }

      // Pause the player
      this._player.pause();

      if (!this._isRequestActive(requestId)) {
        return;
      }

      // Reset the player state
      this._player.reset();

      if (!this._isRequestActive(requestId)) {
        return;
      }

      this._initializeEME(source);
      this._player.src(source);

      // Handle source change event
      this._handleSourceChanged(source);

      // Re-enable fallback before awaiting play(). WebRTC startup can keep the
      // play promise pending during signaling/handshake, and we still want
      // later error/ended events to trigger protocol fallback.
      if (!this._isRequestActive(requestId)) {
        return;
      }

      this._suspendFallback = false;

      // Try to play the new source
      if (source.sourceType !== 'wrts' && shouldResumePlayback) {
        await this._player.play();
      }
    } catch (error) {
      if (!this._isRequestActive(requestId)) {
        return;
      }

      videojs.log('Failed to play source', source, error);

      // If play fails, try the next source after grace period
      if (this._options.autoFallback) {
        this._scheduleRetry();
      }
    } finally {
      if (this._isRequestActive(requestId)) {
        this._suspendFallback = false;
      }
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
  }

  /**
   * Handle videojs error event
   * @param  _ the error event
   * @param error the error message
   */
  _handleError(_: Event, error: unknown) {
    if (this._fallbackBlocked()) {
      return;
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
    if (this._fallbackBlocked()) {
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

    if (this._qualityUpdateTimeout) {
      clearTimeout(this._qualityUpdateTimeout);
    }

    // Delay slightly so VHS/WebRTC quality levels have time to populate.
    this._qualityUpdateTimeout = setTimeout(() => {
      this._qualityUpdateTimeout = null;

      if (this._player.isDisposed()) {
        return;
      }

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

  private _initializeEME(source: VideojsSourceObject) {
    if (!('keySystems' in source) || !source.keySystems) {
      return;
    }

    if (typeof this._player.eme === 'function') {
      this._player.eme();
    }
  }

  /**
   * Try the next source or ends if no more source is available.
   */
  _trySource() {
    if (this._isStopped || !this._sources.length) {
      return;
    }

    this._currentSourceIndex++;

    if (this._currentSourceIndex < this._sources.length) {
      const nextSource = this._sources[this._currentSourceIndex];

      if (!nextSource) {
        return;
      }

      this._setSource(nextSource);
    } else {
      this._completedLoopCount++;

      if (this._maxRetries > 0 && this._completedLoopCount >= this._maxRetries) {
        this.stop();
        return;
      }

      // Start a new loop from the first source when retries are unlimited or
      // when we still have loops remaining.
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
    if (this._isStopped) {
      return;
    }

    this._clearRetryTimeout();

    this._retryTimeout = setTimeout(() => {
      this._retryTimeout = null;

      if (this._isStopped) {
        return;
      }

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

    this._completedLoopCount = 0;
    this._currentSourceIndex = index;

    this._setSource(source);
  }

  /**
   * Replace the plugin options and restart from the first expanded source.
   *
   * This lets integrations refresh stream parameters without disposing the
   * whole Video.js player and losing the underlying DOM element.
   *
   * @param options New plugin options
   */
  replaceOptions(options: CeeblueVideoJSPluginOptions) {
    this._completedLoopCount = 0;
    this._setOptions(options);
    this._currentSourceIndex = 0;

    const source = this._sources[this._currentSourceIndex];

    if (!source) {
      return;
    }

    this._setSource(source);
  }

  stop() {
    this._isStopped = true;
    this._sourceRequestId++;
    this._clearRetryTimeout();
    this._completedLoopCount = 0;
    this._reset();

    const eme = this._player.eme;

    // contrib-eme keeps runtime state on the player after initialization, so we
    // clear it manually to allow replaying the same DRM source after stop().
    if (eme && typeof eme === 'object') {
      eme.activeSrc = null;
      eme.sessions = [];
    }
  }

  private _isRequestActive(requestId: number) {
    return !this._isStopped && requestId === this._sourceRequestId;
  }

  private _clearRetryTimeout() {
    if (this._retryTimeout) {
      clearTimeout(this._retryTimeout);
      this._retryTimeout = null;
    }
  }

  /**
   * Clean up any pending timeouts
   */
  override dispose() {
    if (this._retryTimeout) {
      clearTimeout(this._retryTimeout);
    }
    if (this._qualityUpdateTimeout) {
      clearTimeout(this._qualityUpdateTimeout);
    }
    super.dispose();
  }
}
