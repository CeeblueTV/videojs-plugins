import videojs from 'video.js';

/**
 * Convert a bitrate in bps to a human readable string.
 *
 * @param {number} bitrate The bitrate in bps
 * @return {string} the human readable string
 */
function readableByterate(bitrate) {
  if (bitrate === 0) {
    return '';
  }
  const i = Math.floor(Math.log(bitrate) / Math.log(1000));
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];

  return (bitrate / Math.pow(1000, i)).toFixed(1) * 1 + ' ' + sizes[i];
}

/**
 * The WebRTCTracksController component.
 */
export class WebRTCTracksController {
  /**
   * Controller for the tracks menus and the track selection.
   * Uses `webrtcHandler.source` to read the options.
   *
   * audiobutton: True to enable the audio track menu button. Default: true
   * data: True to listen to all data tracks (see https://docs.videojs.com/texttracklist#event:addtrack for usage). Default: true
   *
   * @param {WebRTCHandler} webrtcHandler the WebRTCHandler instance
   */
  constructor(webrtcHandler) {
    this._player = webrtcHandler.player;
    this._source = webrtcHandler.source;
    this._webRTCPlayer = webrtcHandler.webRTCPlayer;
    this._qualities = this._player.qualityLevels();
    // Map of quality enabled states
    this._enableMap = new Map();
    // Current video track ID
    this._videoTrack = null;

    // Parse options

    // Add the audio track menu button if requested and if there is more than one audio track
    if (this._source.audiobutton !== false && this._source.audiobutton !== 'false' && this._player.audioTracks().length > 1) {
      this._audioTracks = this._player.audioTracks();
    }

    // List to the data events if requested
    if (this._source.data !== false && this._source.data !== 'false') {
      this._textTracks = this._player.textTracks();
      this._webRTCPlayer.onData = (time, trackId, data) => {
        for (let i = 0; i < this._textTracks.length; i++) {
          const track = this._textTracks[i];

          if (track.id === trackId) {
            const currentTime = this._player.tech_.currentTime();

            // +1s to stay in active range
            track.addCue(new VTTCue(currentTime, currentTime + 1, JSON.stringify(data)));
            // Remove previous cue to avoid memory leak
            if (track.cues.length > 1) {
              track.removeCue(track.cues[0]);
            }
            break;
          }
        }
      };
    }

    if (this._webRTCPlayer.controller) {
      // In auto mode the video track chan change without user interaction so we need to check regularly the current video track
      this._webRTCPlayer.onPlaying = () => {
        if (this._videoTrack === this._webRTCPlayer.videoTrack) {
          // no change
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
   * Reset the controller.
   */
  reset() {
    if (this._timeoutChange) {
      clearTimeout(this._timeoutChange);
      this._timeoutChange = null;
    }

    while (this._qualities.length > 0) {
      this._qualities.removeQualityLevel(this._qualities[0]);
    }
    this._enableMap.clear();

    if (this._audioTracks) {
      this._audioTracks.removeEventListener('change');
      while (this._audioTracks.length > 0) {
        this._audioTracks.removeTrack(this._audioTracks[0]);
      }
    }
    if (this._textTracks) {
      this._textTracks.removeEventListener('change');
      while (this._textTracks.length > 0) {
        this._textTracks.removeTrack(this._textTracks[0]);
      }
    }
  }

  /**
   * Update the tracks and qualities
   *
   * @param {Metadata} metadata The metadata object received from the WebRTC player
   */
  update(metadata) {
    if (!this._webRTCPlayer.controller) {
      // whep cannot select tracks
      return;
    }

    // First reset the buttons
    this.reset();

    // Add auto track and select if by default
    if (this._audioTracks) {
      this._audioTracks.addTrack(new videojs.AudioTrack({id: null, kind: 'main', label: 'AUTO', language: 'en', enabled: true}));
    }
    // list of all data tracks IDs to listen to
    const dataTracks = [];

    for (const [trackId, track] of metadata.tracks) {
      switch (track.type) {
      case 'video': {
        const frameRate = track.efpks ? track.efpks : track.fpks;
        const representation = {
          id: trackId,
          width: track.width,
          height: track.height,
          bandwidth: track.ebps ? track.ebps : track.bps,
          frameRate: frameRate ? Math.floor(frameRate / 1000) : 0,
          enabled: this._qualityEnabled(trackId)
        };

        this._qualities.addQualityLevel(representation);
        this._enableMap.set(trackId, true);
        break;
      }
      case 'audio': {
        if (this._audioTracks) {
          const audioTrack = new videojs.AudioTrack({
            id: trackId,
            kind: 'main',
            enabled: false,
            // label: `${track.codec} ${track.channels}ch`,
            label: `${track.codec} ${readableByterate(track.ebps ? track.ebps : track.bps)}`,
            language: 'en',
            bps: track.ebps ? track.ebps : track.bps
          });

          this._audioTracks.addTrack(audioTrack);
        }
        break;
      }
      case 'data': {
        if (this._textTracks) {
          const textTrack = new videojs.TextTrack({
            id: trackId,
            kind: 'metadata',
            label: `${track.codec} ${trackId}`,
            mode: 'showing',
            tech: this._player.tech_,
            default: true
          });

          this._textTracks.addTrack(textTrack);
          dataTracks.push(trackId);
        }
        break;
      }
      }
    }

    if (this._audioTracks) {
      this._audioTracks.addEventListener('change', this._audioTrackChange.bind(this));
    }

    // Listen to all data tracks if enabled
    if (dataTracks.length > 0) {
      this._webRTCPlayer.dataTracks = dataTracks;
    }
  }

  /**
   * Called on audio track change.
   */
  _audioTrackChange() {
    for (let i = 0; i < this._audioTracks.length; i++) {
      const track = this._audioTracks[i];

      if (track.enabled) {
        // if it is not a number it is the auto track
        const id = parseInt(track.id, 10) || null;

        videojs.log('Setting audio track to ' + id + ' (was ' + this._webRTCPlayer.audioTrack + ')');
        this._webRTCPlayer.audioTrack = id;
        return;
      }
    }
  }

  /**
   * Quality getter/setter function.
   *
   * @param {number} trackId Video track ID
   * @return {function} a getter/setter function to enable/disable the track
   */
  _qualityEnabled(trackId) {
    return (value) => {
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
          this._webRTCPlayer.videoTrack = newTrackId;

          // Update the qualitiyLevels
          if (enabled === 1) {
            this._videoTrack = newTrackId;
            this._qualities.selectedIndex_ = index;
          }
          this._qualities.trigger({selectedIndex: this._qualities.selectedIndex_, type: 'change'});
          this._timeoutChange = null;
        }, 0);
      }
    };
  }
}
