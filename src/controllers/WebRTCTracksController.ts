import videojs from 'video.js';
import { WebRTCSource } from '../sources/WebRTCSource';
import type { Player as WebRTCPlayer, Metadata } from '@ceeblue/webrtc-client';
import type QualityLevelList from 'videojs-contrib-quality-levels/dist/types/quality-level-list';
import type AudioTrack from 'video.js/dist/types/tracks/audio-track';
import type Player from 'video.js/dist/types/player';
import type QualityLevel from 'videojs-contrib-quality-levels/dist/types/quality-level';

/**
 * Convert a bitrate in bps to a human readable string.
 *
 * @param {number} bitrate The bitrate in bps
 * @return {string} the human readable string
 */
function readableByterate(bitrate: number): string {
  if (bitrate === 0) {
    return '';
  }
  const i = Math.floor(Math.log(bitrate) / Math.log(1000));
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];

  return `${(bitrate / Math.pow(1000, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * The WebRTCTracksController, Implements VideoJS Quality Levels for Ceeblue's WebRTC sources.
 */
export class WebRTCTracksController {
  private readonly _player: Player;
  private readonly _webRTCPlayer: WebRTCPlayer;
  private readonly _qualities: QualityLevelList & ArrayLike<QualityLevel>;
  private readonly _enableMap: Map<string, boolean>;
  private _videoTrack: number | undefined;
  /**
   * Audio tracks, This is actually AudioTrackList but it's not exported from videojs!
   */
  private _audioTracks?: AudioTrack[];

  /**
   * Timeout change.
   */
  private _timeoutChange: ReturnType<typeof setTimeout> | null;

  /**
   * Current text tracks mapped to their ids in Ceeblue's metadata socket.
   */
  private readonly _textTracks = new Map<number|string, videojs.TextTrack>();

  /**
   * Controller for the tracks menus and the track selection.
   * Uses `webrtcHandler.source` to read the options.
   *
   * audiobutton: True to enable the audio track menu button. Default: true
   * data: True to listen to all data tracks (see https://docs.videojs.com/texttracklist#event:addtrack for usage). Default: true
   *
   * @param {WebRTCSource} webrtcSource the WebRTCSource instance
   */
  constructor(webrtcSource: WebRTCSource) {
    this._player = webrtcSource.player;
    this._webRTCPlayer = webrtcSource.webRTCPlayer!;
    this.update = this.update.bind(this);
    // @ts-expect-error - qualityLevels is not typed.
    this._qualities = this._player.qualityLevels?.();
    if (!this._qualities) {
      throw new Error('QualityLevels not found');
    }

    this._enableMap = new Map();
    this._videoTrack = undefined;
    this._timeoutChange = null;

    // @ts-expect-error - audioTracks is not typed.
    this._audioTracks = this._player.audioTracks();

    // use original track time?
    this._webRTCPlayer.on('data', this._handleDataEvent.bind(this));

    this._audioTrackChange = this._audioTrackChange.bind(this);

    if (this._webRTCPlayer.controller) {
      // In auto mode the video track can change without user interaction so we need to check regularly the current video track
      this._webRTCPlayer.onPlaying = () => {
        if (this._videoTrack === this._webRTCPlayer.videoTrack) {
          return;
        }

        this._videoTrack = this._webRTCPlayer.videoTrack;
        // Update the qualitiyLevels
        for (let i = 0; i < this._qualities.length; i++) {
          const quality = this._qualities[i];

          if (quality.id === this._videoTrack) {
            this._qualities.selectedIndex_ = i;
            this._qualities.trigger({selectedIndex: this._qualities.selectedIndex_, type: 'change'});
            break;
          }
        }
      };
    }
  }

  /**
   * Update the tracks and qualities
   *
   * @param {Metadata} metadata The metadata object received from the WebRTC player
   */
  update(metadata: Metadata) {
    if (!this._webRTCPlayer.controller) {
      // whep cannot select tracks
      return;
    }

    // First reset the buttons
    this._reset();

    // Add auto track and select if by default
    // @ts-expect-error - audioTracks is not typed.
    this._audioTracks?.addTrack(new videojs.AudioTrack({
      id: 'ceeblue-default',
      kind: 'main',
      label: 'AUTO',
      language: 'en',
      enabled: true
    }));

    let audioTrackCount = 0;
    let firstAudioTrack: videojs.AudioTrack | undefined = void 0;

    for (const [trackId, track] of metadata.tracks) {
      switch (track.type) {
      case 'video': {
        // @ts-expect-error - efpks is not typed.
        const frameRate = track.efpks ? track.efpks : track.fpks;
        const representation = {
          id: trackId,
          width: track.width,
          height: track.height,
          // @ts-expect-error - ebps is not typed.
          bandwidth: track.ebps ? track.ebps : track.bps,
          frameRate: frameRate ? Math.floor(frameRate / 1000) : 0,
          // @ts-expect-error - qualityEnabled is not typed.
          enabled: this._qualityEnabled(trackId)
        };

        this._qualities.addQualityLevel(representation);
        // @ts-expect-error - enableMap is not typed.
        this._enableMap.set(trackId, true);
        break;
      }
      case 'audio': {
        // @ts-expect-error - ebps is not typed.
        const bitrate = track.ebps ?? track.bps ?? 0;
        const audioTrack = new videojs.AudioTrack({
          id: trackId,
          kind: 'main',
          enabled: false,
          label: `${track.codec} ${readableByterate(bitrate)}`,
          language: 'en',
          bps: bitrate
        });

        if (audioTrackCount++ === 0) {
          firstAudioTrack = audioTrack;

          break;
        }

        if (firstAudioTrack) {
          // @ts-expect-error - audioTracks is not typed.
          this._audioTracks?.addTrack(firstAudioTrack);
          firstAudioTrack = void 0;
        }

        // @ts-expect-error - audioTracks is not typed.
        this._audioTracks?.addTrack(audioTrack);
        break;
      }
      case 'data': {
        if (this._textTracks) {
          const textTrack = new videojs.TextTrack({
            // @ts-expect-error - VideoJS types are not updated!
            kind: 'metadata',
            label: `${track.codec} ${trackId}`,
            mode: 'showing',
            tech: this._player.tech_,
            default: true
          });

          // @ts-expect-error - textTracks is not typed.
          const textTracks = this._player?.textTracks();

          if (textTracks) {
            this._textTracks.set(trackId, textTrack);
            textTracks.addTrack(textTrack);
          } else {
            videojs.log.warn('Player.textTracks() not found');
          }
        }
        break;
      }
      }
    }

    // @ts-expect-error - audioTracks is not typed.
    this._audioTracks?.addEventListener('change', this._audioTrackChange);
  }

  /**
   * Called on audio track change.
   */
  private _audioTrackChange() {
    for (let i = 0; i < this._audioTracks!.length; i++) {
      const track = this._audioTracks![i];

      if (track.enabled) {
        // if it is not a number it is the auto track
        // @ts-expect-error - id is not typed.
        const id = parseInt(track.id, 10) || undefined;

        videojs.log('Setting audio track to ' + id + ' (was ' + this._webRTCPlayer.audioTrack + ')');
        this._webRTCPlayer.audioTrack = id;
        return;
      }
    }
  }

  /**
   * Handle data events from the WebRTC player.
   */
  private _handleDataEvent(_: number, trackId: number, data: unknown): void {
    const track = this._textTracks.get(trackId);

    if (!track) {
      return;
    }

    const currentTime = this._player.tech_.currentTime();

    // +1s to stay in active range
    track.addCue(new VTTCue(currentTime, currentTime + 1, JSON.stringify(data)));

    // Remove previous cue to avoid memory leak
    if (track.cues_.length > 1) {
      track.removeCue(track.cues_[0]);
    }
  }

  /**
   * Quality getter/setter function.
   *
   * @param {string} trackId Video track ID
   * @return {function} a getter/setter function to enable/disable the track
   */
  private _qualityEnabled(trackId: string): (value?: boolean) => boolean | void {
    return (value?: boolean) => {
      let quality;
      let index;

      for (index = 0; index < this._qualities.length; ++index) {
        if (trackId === this._qualities[index].id) {
          quality = this._qualities[index];
          break;
        }
      }
      if (!quality) {
        // not found, should not happen
        videojs.log.error('Quality not found', trackId, this._qualities);
        return;
      }

      // getter
      if (value === undefined) {
        return this._enableMap.get(trackId);
      }

      // setter
      this._enableMap.set(trackId, value);
      if (value === true && !this._timeoutChange) {
        // We change the track in the next tick to differentiate between 1 track selection
        // and all tracks selection which means auto track
        this._timeoutChange = setTimeout(() => {
          let enabled = 0;
          // loop over _enableMap to count the number of enabled tracks

          for (const [, state] of this._enableMap) {
            if (state) {
              enabled++;
            }
          }
          const newTrackId = enabled > 1 ? undefined : trackId;

          videojs.log('Setting video track to ' + newTrackId + ' (was ' + this._webRTCPlayer.videoTrack + ')');
          this._webRTCPlayer.videoTrack = newTrackId ? parseInt(newTrackId, 10) : undefined;

          // Update the qualitiyLevels
          if (enabled === 1) {
            this._videoTrack = newTrackId ? parseInt(newTrackId, 10) : undefined;
            this._qualities.selectedIndex_ = index;
          }
          this._qualities.trigger({selectedIndex: this._qualities.selectedIndex_, type: 'change'});
          this._timeoutChange = null;
        }, 0);
      }
    };
  }

  /**
   * Reset the controller.
  */
  private _reset() {
    if (this._timeoutChange) {
      clearTimeout(this._timeoutChange);
      this._timeoutChange = null;
    }

    while (this._qualities.length > 0) {
      this._qualities.removeQualityLevel(this._qualities[0]);
    }
    this._enableMap.clear();

    if (this._audioTracks) {
      // @ts-expect-error - audioTracks is not typed.
      this._audioTracks?.removeEventListener('change', this._audioTrackChange);

      for (let i = 0; i < this._audioTracks.length; i++) {
        // @ts-expect-error - audioTracks is not typed.
        this._audioTracks?.removeTrack(this._audioTracks[i]);
      }
    }

    if (this._textTracks.size) {
      // @ts-expect-error - textTracks is not typed.
      const textTracks = this._player.textTracks();

      for (const [id, track] of this._textTracks.entries()) {
        textTracks.removeTrack(track);
        this._textTracks.delete(id);
      }
    }
  }

  public dispose() {
    this._reset();
  }
}
