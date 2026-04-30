# Ceeblue Video.js Plugin

An open-source Video.js plugin for playing streams from the Ceeblue cloud with protocol fallback across WebRTS, WebRTC/WHEP, LL-HLS, HLS and DASH.

## Features

- Ceeblue's WebRTS support.
- WebRTC, WHEP support.
- Playing streams from the Ceeblue cloud.
- HTTP DRM support for HLS, LL-HLS and DASH through `videojs-contrib-eme`.
- Video quality switching.
- Protocol fallback.
- Real-time universal stats API.

## Quick Start

::: code-group

```sh [npm]
npm install @ceeblue/videojs-plugins
```

```html [jsdelivr]
<script src="https://cdn.jsdelivr.net/npm/@ceeblue/videojs-plugins@latest/dist/videojs-plugins.min.js"></script>
```

```sh [yarn]
yarn add @ceeblue/videojs-plugins
```

```sh [pnpm]
pnpm add @ceeblue/videojs-plugins
```

:::

## Quick Example

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
      autoFallback: true
    }
  }
});
```

Direct sources are supported too, including WRTS:

```js
player.src({
  src: 'https://<host>/wrts/<streamName>/index.json',
  type: 'application/json',
  bufferLimitLow: 400,
  bufferLimitHigh: 800
});
```

## DRM

If you use `keySystems`, include [videojs-contrib-eme](https://github.com/videojs/videojs-contrib-eme) before this plugin.

- DRM is supported for HLS, LL-HLS, DASH and WRTS source objects through `keySystems`.
- You can provide `keySystems` globally at the top level of the Ceeblue plugin options.
- `LL-HLS` uses the `hls` settings bucket.
- Per-protocol or per-source `keySystems` override the top-level `keySystems` value.
- The advanced example shows a DRM status label only for streams that are actually detected as encrypted during playback.

## Direct Sources

The plugin registers direct source handlers for:

- WebRTS with `type: 'application/json'`
- WebRTC over WHEP or Ceeblue WebSocket signaling
- HLS, LL-HLS and DASH

For WRTS sources, the documented runtime options are `keySystems`, `bufferLimitLow`, `bufferLimitHigh`, `reliable`, `cmcd`, `cmcdMode`, and `cmcdSid`.

## Documentation

- [Examples](/examples/)
- [Demo](https://ceeblue-demo-mirror.pages.dev/)
- [API Reference](https://docs.ceeblue.net/reference/welcome-to-the-ceeblue-streaming-cloud-api) 
