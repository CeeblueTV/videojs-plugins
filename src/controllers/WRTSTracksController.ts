import videojs from 'video.js';
import type { Metadata, Player as WRTSPlayer } from '@ceeblue/wrts-client';
import type QualityLevelList from 'videojs-contrib-quality-levels/dist/types/quality-level-list';
import type AudioTrack from 'video.js/dist/types/tracks/audio-track';
import type Player from 'video.js/dist/types/player';
import type QualityLevel from 'videojs-contrib-quality-levels/dist/types/quality-level';
import { WRTSSource } from '../sources/WRTSSource';

const DATA_TRACK_TYPE = 0;
const AUDIO_TRACK_TYPE = 1;
const VIDEO_TRACK_TYPE = 2;

function readableByterate(bitrate: number): string {
  if (bitrate === 0) {
    return '';
  }
  const i = Math.floor(Math.log(bitrate) / Math.log(1000));
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];

  return `${(bitrate / Math.pow(1000, i)).toFixed(1)} ${sizes[i]}`;
}

function textDecoderValue(data: Uint8Array): string {
  try {
    return new TextDecoder().decode(data);
  } catch {
    return JSON.stringify(Array.from(data));
  }
}

/**
 * The WRTSTracksController, Implements VideoJS Quality Levels for Ceeblue's WRTS sources.
 */
export class WRTSTracksController {
  private readonly _player: Player;
  private readonly _wrtsPlayer: WRTSPlayer;
  private readonly _qualities: QualityLevelList & ArrayLike<QualityLevel>;
  private readonly _enableMap: Map<number, boolean>;
  private _videoTrack: number | undefined;
  private _audioTracks?: AudioTrack[];
  private _timeoutChange: ReturnType<typeof setTimeout> | null;
  private readonly _textTracks = new Map<number, videojs.TextTrack>();
  private readonly _remoteTextTracks = new Map<number, HTMLTrackElement>();

  constructor(wrtsSource: WRTSSource) {
    this._player = wrtsSource.player;
    this._wrtsPlayer = wrtsSource.wrtsPlayer;
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
    this._audioTrackChange = this._audioTrackChange.bind(this);
    this._textTrackChange = this._textTrackChange.bind(this);
    this._handleDataEvent = this._handleDataEvent.bind(this);
    this._handleTrackChange = this._handleTrackChange.bind(this);

    this._wrtsPlayer.onData = this._handleDataEvent;
    this._wrtsPlayer.onTrackChange = this._handleTrackChange;
  }

  update(metadata: Metadata) {
    if (!this._wrtsPlayer.trackSelectable) {
      return;
    }

    this._reset();

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
      case VIDEO_TRACK_TYPE: {
        const representation = {
          id: trackId,
          width: track.resolution.width,
          height: track.resolution.height,
          bandwidth: track.bandwidth,
          frameRate: track.rate,
          enabled: this._qualityEnabled(trackId)
        };

        this._qualities.addQualityLevel(representation);
        this._enableMap.set(trackId, true);
        break;
      }
      case AUDIO_TRACK_TYPE: {
        const bitrate = track.bandwidth ?? 0;
        const audioTrack = new videojs.AudioTrack({
          id: trackId,
          kind: 'main',
          enabled: false,
          label: `${track.codec} ${readableByterate(bitrate)}`,
          language: track.language ?? 'en',
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
      case DATA_TRACK_TYPE: {
        if (track.codec !== 'SUBTITLE') {
          videojs.log.debug('Unsupported data track codec', track.codec);
          break;
        }
        const remoteTrack = this._player.addRemoteTextTrack({
          kind: 'subtitles',
          label: track.language ? `${track.language}` : `#${trackId}`,
          language: track.language ?? '',
          default: false
        }, true);
        const textTrack = remoteTrack.track;

        if (textTrack) {
          textTrack.mode = 'disabled';
          this._remoteTextTracks.set(trackId, remoteTrack);
          this._textTracks.set(trackId, textTrack);
        } else {
          videojs.log.warn('Remote text track was created without a TextTrack');
        }
        break;
      }
      }
    }

    // @ts-expect-error - audioTracks is not typed.
    this._audioTracks?.addEventListener('change', this._audioTrackChange);
    // @ts-expect-error - textTracks is not typed.
    this._player.textTracks()?.addEventListener('change', this._textTrackChange);

    this._textTrackChange();
  }

  private _audioTrackChange() {
    for (let i = 0; i < this._audioTracks!.length; i++) {
      const track = this._audioTracks![i];

      if (!track) {
        continue;
      }

      if (track.enabled) {
        // @ts-expect-error - id is not typed.
        const id = parseInt(track.id, 10) || undefined;

        videojs.log('Setting audio track to ' + id + ' (was ' + this._wrtsPlayer.audioTrack + ')');
        this._wrtsPlayer.audioTrack = id;
        return;
      }
    }
  }

  private _handleDataEvent(trackId: number, _: number, duration: number, data: Uint8Array): void {
    const track = this._textTracks.get(trackId);

    if (!track) {
      return;
    }

    const currentTime = this._player.tech_.currentTime();
    const cueDuration = Math.max(duration / 1000, 1);
    const textTrack = track as videojs.TextTrack & { cues_?: TextTrackCueList & { [index: number]: TextTrackCue | undefined } };

    textTrack.addCue(new VTTCue(currentTime, currentTime + cueDuration, textDecoderValue(data)));

    if (textTrack.cues_?.length && textTrack.cues_.length > 1) {
      const firstCue = textTrack.cues_[0];

      if (firstCue) {
        textTrack.removeCue(firstCue);
      }
    }
  }

  private _textTrackChange() {
    const selectedTrackIds = new Set<number>();

    for (const [trackId, textTrack] of this._textTracks.entries()) {
      if (textTrack.mode === 'showing') {
        selectedTrackIds.add(trackId);
      }
    }

    const selectedText = Array.from(selectedTrackIds).join(', ');
    const currentText = Array.from(this._wrtsPlayer.dataTrack ?? []).join(', ');

    if (selectedText === currentText) {
      return;
    }

    videojs.log('Setting data tracks to [' + selectedText + '] (was [' + currentText + '])');
    this._wrtsPlayer.dataTrack = selectedTrackIds;
  }

  private _handleTrackChange(audioTrack: number, videoTrack: number, dataTrack: Set<number>): void {
    if (this._audioTracks) {
      for (let i = 0; i < this._audioTracks.length; i++) {
        const track = this._audioTracks[i];

        if (!track) {
          continue;
        }

        // @ts-expect-error - id is not typed.
        const id = parseInt(track.id, 10) || undefined;

        track.enabled = id === audioTrack || (id === undefined && this._wrtsPlayer.audioTrack === undefined);
      }
    }

    for (const [trackId, textTrack] of this._textTracks.entries()) {
      textTrack.mode = dataTrack.has(trackId) ? 'showing' : 'disabled';
    }

    if (this._videoTrack === videoTrack) {
      return;
    }

    this._videoTrack = videoTrack;

    for (let i = 0; i < this._qualities.length; i++) {
      const quality = this._qualities[i];

      if (!quality) {
        continue;
      }

      if (quality.id === this._videoTrack) {
        this._qualities.selectedIndex_ = i;
        this._qualities.trigger({selectedIndex: this._qualities.selectedIndex_, type: 'change'});
        break;
      }
    }
  }

  private _qualityEnabled(trackId: number): (value?: boolean) => boolean | undefined {
    return (value?: boolean) => {
      let quality: QualityLevel | undefined;
      let index = -1;

      for (index = 0; index < this._qualities.length; ++index) {
        const currentQuality = this._qualities[index];

        if (currentQuality && trackId === currentQuality.id) {
          quality = currentQuality;
          break;
        }
      }
      if (!quality) {
        videojs.log.error('Quality not found', trackId, this._qualities);
        return;
      }

      if (value === undefined) {
        return this._enableMap.get(trackId);
      }

      this._enableMap.set(trackId, value);
      if (value === true && !this._timeoutChange) {
        this._timeoutChange = setTimeout(() => {
          let enabled = 0;

          for (const [, state] of this._enableMap) {
            if (state) {
              enabled++;
            }
          }
          const newTrackId = enabled > 1 ? undefined : trackId;

          videojs.log('Setting video track to ' + newTrackId + ' (was ' + this._wrtsPlayer.videoTrack + ')');
          this._wrtsPlayer.videoTrack = newTrackId;

          if (enabled === 1) {
            this._videoTrack = newTrackId;
            this._qualities.selectedIndex_ = index;
          }
          this._qualities.trigger({selectedIndex: this._qualities.selectedIndex_, type: 'change'});
          this._timeoutChange = null;
        }, 0);
      }

      return undefined;
    };
  }

  private _reset() {
    if (this._timeoutChange) {
      clearTimeout(this._timeoutChange);
      this._timeoutChange = null;
    }

    while (this._qualities.length > 0) {
      const quality = this._qualities[0];

      if (!quality) {
        break;
      }
      this._qualities.removeQualityLevel(quality);
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

    // @ts-expect-error - textTracks is not typed.
    this._player.textTracks()?.removeEventListener('change', this._textTrackChange);

    if (this._remoteTextTracks.size) {
      for (const [id, remoteTrack] of this._remoteTextTracks.entries()) {
        this._player.removeRemoteTextTrack(remoteTrack);
        this._remoteTextTracks.delete(id);
        this._textTracks.delete(id);
      }
    }
  }

  public dispose() {
    this._wrtsPlayer.onData = () => {};
    this._wrtsPlayer.onTrackChange = () => {};
    this._reset();
  }
}
