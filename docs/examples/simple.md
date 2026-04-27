<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  import('../.vitepress/theme/exampleEditorViewer.ts')
})
</script>

# Basic Setup

This example demonstrates a minimal setup of Video.js with the `ceeblue` plugin and Ceeblue protocol fallback.

## HTML Setup


:::example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ceeblue Video.js Plugin</title>
  <link href="https://cdn.jsdelivr.net/npm/video.js@8.22.0/dist/video-js.css" rel="stylesheet">
  <link href="/dist/videojs-plugins.css" rel="stylesheet">
</head>
<body>
  <div class="player-container"></div>
  <script type="module">
  const streamname = 'out+de1e6f7c-e5db-450b-9603-c3644274779b';
  const host = 'fly.live.ceeblue.tv';
  const token = '';
  const protocols = ['wrts', 'webrtc', 'llhls', 'hls', 'dash'];

  import 'https://cdn.jsdelivr.net/npm/video.js@8.22.0/dist/video.min.js';
  import '/dist/videojs-plugins.js';

  const video = document.createElement('video');
  video.muted = true;
  const videoPlayerContainer = document.querySelector('.player-container');

  if (!videoPlayerContainer) {
    throw new Error('Player container not found');
  }

  video.className = 'video-js vjs-default-skin';
  video.controls = true;
  video.preload = 'auto';
  videoPlayerContainer.appendChild(video);

  const playerJS = videojs(video, {
    controls: true,
    responsive: true,
    fluid: true,
    bigPlayButton: true,
    plugins: {
      ceeblue: {
        autoFallback: true,
        autoRetry: true,
        endPoint: host,
        streamName: streamname,
        accessToken: token,
        protocols: protocols,
      },
    }
  });
  playerJS.on('loadedmetadata', (e) => {
    console.log('loadedmetadata', e);
  });
  playerJS.on('sourcechanged', (event) => {
    console.log('sourcechanged', event.details.source);
  });
  </script>
</body>
</html>
```
:::

## Notes

- The plugin expands Ceeblue source definitions into actual Video.js source objects.
- `sourcechanged` is emitted for the initial source and on every later fallback or manual protocol change.
- HTTP DRM can be added later through `settings.hls.keySystems` and `settings.dash.keySystems` when `videojs-contrib-eme` is included.
- If you want to bypass fallback and use a direct WebRTS source, the repository also includes `examples/wrts-player.html` and the README documents the `WRTSSource` fields (`bufferLimitLow`, `bufferLimitHigh`, `reliable`, `cmcd`, `cmcdMode`, `cmcdSid`).

## Best Practices

1. Always include error handling.
2. Use appropriate video dimensions.
3. Consider mobile responsiveness.
4. Test across different browsers.
5. Monitor player events for debugging.
