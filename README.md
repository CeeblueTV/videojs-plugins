# videojs-plugins

[![npm](https://img.shields.io/npm/v/%40ceeblue%2Fvideojs-plugins)](https://npmjs.org/package/@ceeblue/videojs-plugins)

Set of [Videojs] plugins for playing streams from the [Ceeblue] cloud.

This plugin contains :

- **[WebRTCSource](#webrtcsource)**, a [Videojs] WebRTC playback source handler supporting [WHEP] and the Ceeblue WebSocket custom signaling,
- **[QualityButton](#qualitybutton)**, a plugin to select the video quality for any kind of source implementing [videojs-contrib-quality-levels],
- **[SourceController](#sourcecontroller)**, a utility class to switch automatically from one Ceeblue source to another (including WebRTC, HLS, LLHLS and DASH),

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)
- [WebRTCSource](#webrtcsource)
  - [Parameters](#parameters)
    - [**src**](#src)
    - [**type**](#type)
    - [**iceservers**](#iceservers)
    - [**audiobutton**](#audiobutton)
    - [**data**](#data)
  - [Source Object](#source-object)
  - [`<source>` HTML tag](#source-html-tag)
- [QualityButton](#qualitybutton)
- [SourceController](#sourcecontroller)
  - [Disabling QualityButton](#disabling-qualitybutton)
- [Examples](#examples)
- [Documentation](#documentation)
- [Contribution](#contribution)
- [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->
## Installation

Download the package from [@ceeblue/videojs-plugins][npm-url] or build it manually from the [github sources][github-sources] :

```sh
npm install
npm run build
```

Include [@ceeblue/videojs-plugins][npm-url] in your HTML code as usual with the link to [Videojs] and this library.

Example :

```html
<script src="https://vjs.zencdn.net/8.7.0/video.min.js"></script>
<script src="./dist/videojs-plugins.js"></script>
```

## WebRTCSource

### Parameters

#### **src**

The `src` field contains the URL of the WebRTC endpoint.

The protocol can be WebSocket (`wss`) to get the best of the custom Ceeblue signaling or HTTP (`https`) to use the standard WHEP signaling protocol.

Here is the expected format :

```js
[wss|https]://<ceeblue-host>[/<pathname>]/<streamId>[?id=<token>][&audio=<audioTrackId>][&video=<videoTrackId>]
```

And here is an example of a complete WebSocket URL:

```js
wss://la-8.live.ceeblue.tv/as+12346f7c-e5db-450b-9603-c3644274779b
```

The following options can be set in the query:

- **id :** The string token in case the stream is private.

- **audio :** the audio track ID or `none` to disable audio.

- **video :** the video track ID or `none` to disable video.

#### **type**

**It is important for the MIME-type to be empty to use the WebRTC source.**

#### **iceservers**

Ice-servers (STUN, TURN) structure in JSON string format to establish a WebRTC connection.

**Note:** Do not enclose the object in an array.

**Example:**

> Replace `<ceeblue-host>` by your endpoint hostname

```js
{
  "urls": ["turn:<ceeblue-host>?transport=tcp", "turn:<ceeblue-host>:3478"],
  "username": "csc_demo",
  "credential": "UtrAFClFFO"
}
```

#### **audiobutton**

`false` to disable the WebRTC audio track selection button, `true` by default.

#### **data**

`true` to listen to all timed metadata tracks, `false` otherwise. `true` by default.

> This has no effect on the player, to get the timed metadatas in your application you must use the [textTracks() API](https://videojs.com/guides/text-tracks/) of [Videojs], you can check [examples/player.html](./examples/player.html) for an example of usage.

### Source Object

Call the `player.src()` method with a WebRTC URL.

**Example:**

> Replace `<ceeblue-host>` by your endpoint hostname and `<streamId>` by your stream name.

```html
<script type="module">
  import {} from "/path/to/video.min.js";
  import {} from "/path/to/ceeblue/videojs-plugins.min.js";
  ...
  const player = videojs('video-tag');
  player.src({
    src: 'wss://<ceeblue-host>/<streamId>',
    iceservers: '{
      "urls": ["turn:<ceeblue-host>?transport=tcp", "turn:<ceeblue-host>:3478"],
      "username": "csc_demo",
      "credential": "UtrAFClFFO"
    }',
    audiobutton: true,
    data: false
  });
  player.start();
</script>
```

### `<source>` HTML tag

The WebRTC source can be set directly in the HTML Source tag.

**Example:**

> Replace `<ceeblue-host>` by your endpoint hostname and `<streamId>` by your stream name.

```html
<script src="//path/to/video.min.js"></script>
<script src="//path/to/ceeblue/videojs-plugins.min.js"></script>

<div id="video_container">
    <video id=video-player width=960 height=540 class="video-js vjs-default-skin" controls>
        <source src="wss://<ceeblue-host>/webrtc/<streamId>" 
            iceServers='{"urls": ["turn:<ceeblue-host>?transport=tcp", "turn:<ceeblue-host>:3478"], "username": "csc_demo", "credential": "UtrAFClFFO"}'>
    </video>
</div>
<script>
  var player = videojs('video-player');
</script>
```

## QualityButton

If you are not using the [SourceController](#sourcecontroller), the QualityButton plugin can be called with a simple command to create the video menu button using the qualityLevels of the current source (see [videojs-contrib-quality-levels]):

```html
<script>
  var player = videojs('video-player');
  player.qualityButton();
</script>
```

## SourceController

The [SourceController](./src/controllers/SourceController.js) allows to configure fallback sources when the current source is not working (for example if WebRTC is not supported in the browser). It is also suited to switch smoothly from one source to the other.

The constructor of `SourceController` only takes one argument : the videojs player.

To start the `SourceController` call the `start()` function with the following arguments :

- The `ConnectParams` structure containing the host, the stream name, the access token (optional) and the query parameters (optional),
- The list of sources in order of priority. A source can be a string from the `SourceType` list or a [Source Object] in order to set custom options.

> See `SourceType` object in [SourceController.js](./src/controllers/SourceController.js) which defines the list of possible sources,

**Example:**

> Replace `<ceeblue-host>` by your endpoint hostname and `<streamId>` by your stream name.

```javascript
  const sourceController = new SourceController(
    player
  );
  sourceController.on('sourcechanged', (source) => {
    console.log('sourcechanged', source); // null means no more sources available
  });
  sourceController.start(
    {
      host: '<ceeblue-host>',
      streamName: '<streamId>'
    }, 
    [{
        src: 'wss://<ceeblue-host>/<streamId>',
        iceservers: '{"urls": ["turn:<ceeblue-host>?transport=tcp", "turn:<ceeblue-host>:3478"], "username": "csc_demo", "credential": "UtrAFClFFO"}',
     },
      'llhls',
      'dash', 
      'hls'
    ]);
```

### Disabling QualityButton

By default the SourceController creates a [QualityButton](#qualitybutton) for the current source but you can disable it in the player's options with the `qualityButton` option:

```javascript
const player = videojs(videoEl, { qualityButton: false});
```

## Examples

You can find examples of players in the [examples/](./examples/) directory :

- **player.html** : The most advanced example which use WebRTC, the [SourceController](#sourcecontroller), and the [QualityButton](#qualitybutton), with a complete UI for setting parameters and showing timed metadatas.
- **simple-player.html** : A simple example with a WebRTC source configured with the HTML `<source>` tag.

## Documentation

This monorepo also contains built-in documentation about the APIs in the library, which can be built using the following npm command:

```shell
npm run docs
```

You can access the documentation by opening the index.html file in the docs folder with your browser (`./docs/api/index.html`).

## Contribution

All contributions are welcome. Please see [our contribution guide](/CONTRIBUTING.md) for details.

## License

By contributing code to this project, you agree to license your contribution under the [GNU Affero General Public License](/LICENSE).

[ceeblue]: https://ceeblue.net/
[github-sources]: https://github.com/CeeblueTV/videojs-plugins
[npm-url]: https://www.npmjs.com/package/@ceeblue/videojs-plugins
[Source Object]: https://www.w3schools.com/JSREF/dom_obj_source.asp
[videojs]: https://videojs.com/
[videojs-options]: https://videojs.com/guides/options
[videojs-contrib-quality-levels]: https://github.com/videojs/videojs-contrib-quality-levels
[WHEP]: https://datatracker.ietf.org/doc/draft-murillo-whep/
