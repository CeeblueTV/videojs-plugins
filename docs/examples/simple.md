<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  import('../.vitepress/theme/exampleEditorViewer.ts')
})
</script>

# Basic Setup

This example demonstrates the basic setup of Video.js with the Ceeblue plugin.

## HTML Setup


:::example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ceeblue Video.js Plugin</title>
  <link href="https://vjs.zencdn.net/8.20.0/video-js.css" rel="stylesheet">
  <link href="/dist/videojs-plugins.css" rel="stylesheet">
</head>
<body>
  <div class="player-container"></div>
  <script type="module">
  const streamname = 'out+de1e6f7c-e5db-450b-9603-c3644274779b';
  const host = 'fly.live.ceeblue.tv';
  const token = '';
  const protocols = ['hls'];

  import 'https://vjs.zencdn.net/8.20.0/video.min.js';
  import '/dist/videojs-plugins.js';

  const video = document.createElement('video');
  const videoPlayerContainer = document.querySelector('.player-container');

  if (!videoPlayerContainer) {
    throw new Error('Player container not found');
  }

  video.className = 'video-js vjs-default-skin';
  video.controls = true;
  video.preload = 'auto';
  videoPlayerContainer.appendChild(video);

  playerJS = videojs(video, {
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

  videoPlayerContainer.appendChild(playerJS.getPlayer());
  </script>
</body>
</html>
```
:::

## Best Practices

1. Always include error handling.
2. Use appropriate video dimensions.
3. Consider mobile responsiveness.
4. Test across different browsers.
5. Monitor player events for debugging.

## Next Steps

