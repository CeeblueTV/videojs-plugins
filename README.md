# videojs-plugins

[![npm](https://img.shields.io/npm/v/%40ceeblue%2Fvideojs-plugins)](https://npmjs.org/package/@ceeblue/videojs-plugins)

Set of [Videojs] plugins for playing streams from the [Ceeblue] cloud.

This plugin contains:

- **[WebRTCSource](#webrtcsource)**, a [Videojs] WebRTC playback source handler supporting [WHEP] and the Ceeblue WebSocket custom signaling,
- **[WRTSSource](#wrtssource)**, a [Videojs] [WebRTS] playback source handler for Ceeblue's HTTPS segmented low-latency protocol,
- **[QualityButton](#qualitybutton)**, a plugin to select the video quality for any kind of source implementing [videojs-contrib-quality-levels],
- **[Ceeblue Plugin](#ceeblue-plugin)**, a Video.js plugin that expands Ceeblue sources, enables protocol fallback, and switches automatically between [WebRTS], WebRTC, LL-HLS, HLS and DASH.

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)
- [WebRTCSource](#webrtcsource)
  - [Parameters](#parameters)
    - [**src**](#src)
    - [**type**](#type)
    - [**iceServers**](#iceservers)
  - [Source Object](#source-object)
  - [`<source>` HTML tag](#source-html-tag)
- [WRTSSource](#wrtssource)
  - [Parameters](#parameters-1)
    - [**src**](#src-1)
    - [**type**](#type-1)
    - [**bufferLimitLow**](#bufferlimitlow)
    - [**bufferLimitHigh**](#bufferlimithigh)
    - [**reliable**](#reliable)
    - [**cmcd**](#cmcd)
    - [**cmcdMode**](#cmcdmode)
    - [**cmcdSid**](#cmcdsid)
  - [Source Object](#source-object-1)
  - [`<source>` HTML tag](#source-html-tag-1)
- [QualityButton](#qualitybutton)
- [Ceeblue Plugin](#ceeblue-plugin)
  - [Initialization](#initialization)
  - [Source Events](#source-events)
  - [DRM for HLS and DASH](#drm-for-hls-and-dash)
  - [Disabling QualityButton](#disabling-qualitybutton)
- [Examples](#examples)
- [Documentation](#documentation)
- [Contribution](#contribution)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
## Installation

Download the package from [@ceeblue/videojs-plugins][npm-url] or build it manually from the [github sources][github-sources]:

```sh
npm install
npm run build
```

Include [@ceeblue/videojs-plugins][npm-url] in your HTML code as usual with the link to [Videojs] and this library.

If you use `keySystems` for DRM playback, also include [videojs-contrib-eme](https://github.com/videojs/videojs-contrib-eme) before this plugin.

Example:

```html
<script src="https://cdn.jsdelivr.net/npm/video.js@8.22.0/dist/video.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/videojs-contrib-eme@5.5.2/dist/videojs-contrib-eme.min.js"></script>
<script src="./dist/videojs-plugins.js"></script>
```

## WebRTCSource

### Parameters

#### **src**

The `src` field contains the URL of the WebRTC endpoint.

The protocol can be WebSocket (`wss`) to get the best of the custom Ceeblue signaling or HTTP (`https`) to use the standard [WHEP] signaling protocol.

Here is the expected format:

```js
[wss|https]://<host>[/<pathname>]/<streamName>[?id=<accessToken>][&audio=<audioTrackId>][&video=<videoTrackId>]
```

And here is an example of a WebSocket URL:

```js
wss://la-8.live.ceeblue.tv/as+12346f7c-e5db-450b-9603-c3644274779b
```

The following options can be set in the query:

- **id** The access token in case the stream is private.
- **audio** the audio track ID or `none` to disable audio.
- **video** the video track ID or `none` to disable video.

#### **type**

**It is important for the MIME-type to be empty to use the WebRTC source.**

#### **iceServers**

[RTCIceServer](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection#iceservers) objects used to establish the WebRTC connection, mainly for TCP fallback.

If not set, the plugin will use the default TURN server for the Ceeblue endpoint.

**Example:**

> Replace `<host>` by your endpoint hostname

```js
[
  {
    urls: ["turn:<host>?transport=tcp", "turn:<host>:3478"],
    username: "ceeblue",
    credential: "ceeblue"
  }
]
```

### Source Object

Call the `player.src()` method with a WebRTC URL.

**Example:**

> Replace `<host>` by your endpoint hostname and `<streamName>` by your stream name.

```html
<script type="module">
  import {} from "/path/to/video.min.js";
  import {} from "/path/to/ceeblue/videojs-plugins.min.js";
  ...
  const player = videojs('video-tag');
  player.src({
    src: 'wss://<host>/<streamName>',
    iceServers: [{
      urls: ['turn:<host>?transport=tcp', 'turn:<host>:3478'],
      username: 'ceeblue',
      credential: 'ceeblue'
    }],
  });
</script>
```

### `<source>` HTML tag

The WebRTC source can be set directly in the HTML Source tag.

**Example:**

> Replace `<host>` by your endpoint hostname and `<streamName>` by your stream name.

```html
<script src="//path/to/video.min.js"></script>
<script src="//path/to/ceeblue/videojs-plugins.min.js"></script>

<div id="video_container">
    <video id=video-player width=960 height=540 class="video-js vjs-default-skin" controls>
        <source src="wss://<host>/webrtc/<streamName>" 
            iceservers='[{"urls":["turn:<host>?transport=tcp","turn:<host>:3478"],"username":"ceeblue","credential":"ceeblue"}]'>
    </video>
</div>
<script>
  var player = videojs('video-player');
</script>
```

## WRTSSource

### Parameters

#### **src**

The `src` field contains the URL of the WebRTS endpoint.

Here is the expected format:

```js
https://<host>/wrts/<streamName>/index.json[?id=<accessToken>]
```

And here is an example URL:

```js
https://la-8.live.ceeblue.tv/wrts/as+12346f7c-e5db-450b-9603-c3644274779b/index.json
```

The following query option can be set:

- **id** The access token in case the stream is private.

#### **type**

Use `application/json` for a direct WRTS source.

#### **bufferLimitLow**

Low buffer threshold in milliseconds.

#### **bufferLimitHigh**

High buffer threshold in milliseconds.

#### **reliable**

`true` to disable adaptive frame-skipping and favor reliable playback.

#### **cmcd**

[CMCD](https://cdn.cta.tech/cta/media/media/resources/standards/pdfs/cta-5004-final.pdf) verbosity forwarded to `@ceeblue/wrts-client`.

Set the level of CMCD data to be sent: `'full'` sends all available keys, `'short'` sends only the necessary keys, `'none'` disables CMCD.

#### **cmcdMode**

CMCD delivery mode forwarded to `@ceeblue/wrts-client`.

Define the CMCD delivery method: `'header'` sends the CMCD data in HTTP headers, `'query'` sends it via the query string.

#### **cmcdSid**

CMCD session identifier forwarded to `@ceeblue/wrts-client`.

Specify a unique session ID for tracking the client session.

### Source Object

Call the `player.src()` method with a WRTS URL.

**Example:**

> Replace `<host>` by your endpoint hostname and `<streamName>` by your stream name.

```html
<script type="module">
  import {} from "/path/to/video.min.js";
  import {} from "/path/to/ceeblue/videojs-plugins.min.js";

  const player = videojs('video-tag');
  player.src({
    src: 'https://<host>/wrts/<streamName>/index.json',
    type: 'application/json',
    bufferLimitLow: 400,
    bufferLimitHigh: 800,
    reliable: false
  });
</script>
```

### `<source>` HTML tag

The WRTS source can also be set directly in the HTML Source tag.

**Example:**

> Replace `<host>` by your endpoint hostname and `<streamName>` by your stream name.

```html
<script src="//path/to/video.min.js"></script>
<script src="//path/to/ceeblue/videojs-plugins.min.js"></script>

<div id="video_container">
    <video id=video-player width=960 height=540 class="video-js vjs-default-skin" controls>
        <source src="https://<host>/wrts/<streamName>/index.json" type="application/json">
    </video>
</div>
<script>
  var player = videojs('video-player');
</script>
```

## QualityButton

If you are not using the `ceeblue` plugin fallback flow, the QualityButton plugin can be called with a simple command to create the video menu button using the qualityLevels of the current source (see [videojs-contrib-quality-levels]):

```html
<script>
  var player = videojs('video-player');
  player.qualityButton();
</script>
```

## Ceeblue Plugin

The `ceeblue` plugin expands Ceeblue source definitions into Video.js source objects and can automatically fall back between protocols when playback fails.

### Initialization

You can initialize the plugin either in the Video.js options or after player creation:

```js
const player = videojs('video-player', {
  controls: true,
  responsive: true,
  fluid: true,
  plugins: {
    ceeblue: {
      endPoint: '<host>',
      streamName: '<streamName>',
      accessToken: '<accessToken>',
      protocols: ['wrts', 'webrtc', 'llhls', 'hls', 'dash'],
      autoFallback: true,
      maxRetries: 3
    }
  }
});
```

```js
const player = videojs('video-player');

player.ceeblue({
  endPoint: '<host>',
  streamName: '<streamName>',
  protocols: ['webrtc', 'hls']
});
```

Direct URL sources are also supported:

```js
player.ceeblue({
  sources: [
    { url: 'https://<host>/wrts/<streamName>/index.json', type: 'wrts' },
    { url: 'wss://<host>/webrtc/<streamName>', type: 'webrtc' },
    { url: 'https://<host>/cmaf/<streamName>/index.m3u8', type: 'llhls' },
    { url: 'https://<host>/cmaf/<streamName>/index.mpd', type: 'dash' }
  ],
  autoFallback: true
});
```

### Source Events

The plugin emits a `sourcechanged` event whenever the active source changes. The initial source is also emitted on the next tick after plugin creation so listeners registered immediately after `videojs(...)` can still observe it.

```js
player.on('sourcechanged', (event) => {
  console.log('sourcechanged', event.details.source);
});
```

You can force a protocol or source index at runtime:

```js
player.ceeblue().setSource({ protocol: 'dash' });
player.ceeblue().setSource(0);
```

### DRM for HLS, DASH and WRTS

DRM support is currently available for HLS, LL-HLS, DASH and WRTS sources through the standard Video.js `keySystems` option.

- Include `videojs-contrib-eme` before this plugin when using DRM.
- You can set `keySystems` globally at the top level of the Ceeblue plugin options.
- `LL-HLS` uses the `hls` settings bucket.
- Top-level `settings` are merged into each Ceeblue cloud source, and per-source settings take precedence.
- Per-protocol or per-source `keySystems` override the top-level `keySystems` value.

This works both as a global default and in per-protocol/per-source overrides:

```js
player.ceeblue({
  endPoint: '<endPoint>',
  streamName: '<streamName>',
  protocols: ['wrts', 'hls', 'dash'],
  keySystems: {
    'com.widevine.alpha': '...',
    'com.microsoft.playready': '...',
    'com.apple.fps': {
      certificateUri: '...',
      licenseUri: '...'
    }
  },
  settings: {
    wrts: {
      keySystems: {
        'com.widevine.alpha': '...',
        'com.microsoft.playready': '...'
      }
    },
    hls: {
      keySystems: {
        'com.apple.fps': {
          certificateUri: '...',
          licenseUri: '...'
        },
        'com.widevine.alpha': '...'
      }
    },
    dash: {
      keySystems: {
        'com.widevine.alpha': '...',
        'com.microsoft.playready': '...'
      }
    }
  }
});
```

```js
player.ceeblue({
  sources: [
    {
      url: 'https://example.com/stream.mpd',
      type: 'dash'
    },
    {
      url: 'https://example.com/wrts/stream/index.json',
      type: 'wrts'
    }
  ],
  keySystems: {
    'com.widevine.alpha': '...',
    'com.microsoft.playready': '...',
    'com.apple.fps': {
      certificateUri: '...',
      licenseUri: '...'
    }
  }
});
```

You can still override the global DRM config on a specific source:

```js
player.ceeblue({
  sources: [
    {
      url: 'https://example.com/wrts/stream/index.json',
      type: 'wrts',
      keySystems: {
        'com.widevine.alpha': '...',
        'com.microsoft.playready': '...'
      }
    }
  ]
});
```

### Disabling QualityButton

By default the plugin updates the [QualityButton](#qualitybutton) for the current source, but you can disable it with the `enableQualityOptions` option:

```javascript
const player = videojs(videoEl, {
  plugins: {
    ceeblue: {
      endPoint: '<host>',
      streamName: '<streamName>',
      enableQualityOptions: false
    }
  }
});
```

## Examples

Examples can be found in the [examples/](./examples/) directory:

- **player.html** An advanced example using the `ceeblue` plugin with protocol fallback, DRM-capable HTTP playback, quality selection, CDM status for encrypted streams, and real-time metrics.
- **simple-player.html** A simple example using the `ceeblue` plugin with default parameters.
- **webrtc-player.html** A simple example with a WebRTC source configured with the HTML `<source>` tag.
- **wrts-player.html** A simple example focused on WebRTS source configured with the HTML `<source>` tag.

All examples include the HTML code to include the library and player, and the JavaScript code to configure the player.
You can add query parameters to the URL to test the different options.

For example:
> Replace `<host>` with your endpoint host name, `<streamName>` with your stream name, and `<accessToken>` with the
viewer access token provided by the Ceeblue Cloud API (optional, only if the stream is private).

```html
https://localhost:8080/examples/player.html?host=<host>&stream=<streamName>&accessToken=<accessToken>
```

## Documentation

This monorepo also contains built-in documentation about the APIs in the library, which can be built using the following npm command:

```shell
npm run docs
```

Run `npm run docs:dev` for local development or open the generated VitePress site in `docs/.vitepress/dist/`.

## Contribution

All contributions are welcome. Please see [our contribution guide](/CONTRIBUTING.md) for details.

## License

By contributing code to this project, you agree to license your contribution under the [GNU Affero General Public License](/LICENSE).

[ceeblue]: https://ceeblue.net/
[Connect class]: https://github.com/CeeblueTV/web-utils/blob/main/src/Connect.ts
[github-sources]: https://github.com/CeeblueTV/videojs-plugins
[npm-url]: https://www.npmjs.com/package/@ceeblue/videojs-plugins
[Source Object]: https://www.w3schools.com/JSREF/dom_obj_source.asp
[videojs]: https://videojs.com/
[videojs-options]: https://videojs.com/guides/options
[videojs-contrib-quality-levels]: https://github.com/videojs/videojs-contrib-quality-levels
[WebRTS]: https://github.com/CeeblueTV/wrts-client
[WHEP]: https://datatracker.ietf.org/doc/draft-murillo-whep/
