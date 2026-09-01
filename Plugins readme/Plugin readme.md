# Orphira Plugin SDK

Orphira plugins are sandboxed JavaScript extensions for Orphira.

A plugin developer does not need the Orphira source code and must not use internal Orphira objects, DOM selectors, Electron or Node.js.

## Requirements

- Node.js
- Orphira 1.2.6 or newer
- A text editor such as VS Code

## Your first plugin

Create a folder:

```text
my-plugin/
├── manifest.json
└── plugin.js
````

Create `manifest.json`:

JSON

```
{
  "$schema": "../plugin-manifest.schema.json",
  "manifestVersion": 1,
  "id": "com.example.hello",
  "name": "My First Plugin",
  "version": "1.0.0",
  "description": "My first Orphira plugin.",
  "author": "Developer",
  "license": "MIT",
  "orphira": {
    "apiVersion": 2,
    "minimumVersion": "1.2.6"
  },
  "entry": "plugin.js",
  "permissions": [
    "ui:notifications"
  ],
  "network": {
    "hosts": []
  },
  "contributes": {
    "commands": [],
    "themes": [],
    "locales": [],
    "views": []
  }
}
```

Create `plugin.js`:

JavaScript

```
module.exports = {
  async activate(api) {
    await api.notifications.show(
      'Hello from my plugin',
      'success'
    );
  },

  async deactivate() {
  }
};
```

From the Orphira repository run:

text

```
npm run pack-plugin -- ./my-plugin
```

The packer creates:

text

```
my-plugin.orphira-plugin
```

Install it through:

text

```
Settings → Plugins → Install from File
```

Enable the plugin.

## Normal project layout

text

```
my-plugin/
├── manifest.json
├── plugin.js
├── locales/
│   └── en.json
├── themes/
│   └── theme.css
└── views/
    └── dashboard.html
```

The packer recursively includes text files from the source project and converts them to Orphira's installable package format.

## Security

A safe Orphira plugin does not receive:

- Node.js
- Electron
- `require()`
- filesystem access
- `window.api`
- `window.state`
- Orphira's internal DOM
- arbitrary network access

Use only the public Plugin API.

Network access requires the `network` permission and an HTTPS hostname declared in the manifest.

## Documentation

- `README.md` — first plugin
- `PLUGIN-SDK.md` — recipes and examples
- `PLUGIN-API-REFERENCE.md` — API contract
- `orphira-plugin.d.ts` — IntelliSense declarations
- `plugin-manifest.schema.json` — manifest schema

## Examples

`examples/hello-world/` is the basic reference project.

`examples/spotify-like-layout/` exercises the public Component/Layout API without using Orphira DOM selectors.

Existing `.orphira-plugin` files remain valid and can still be installed directly.

## Package manually to another location

text

```
npm run pack-plugin -- ./my-plugin --out ./dist/my-plugin.orphira-plugin
```

## Plugin API version

Current public Plugin API version:

text

```
2
```

Current manifest version:

text

```
1
```

text

````

Добавили Quick Start от исходника до установки.

FILE: PLUGIN-SDK.md
Изменение: превращаем старый machine-oriented документ в Cookbook.

Замени файл целиком:

```markdown
# Orphira Plugin SDK Cookbook

Manifest Version: 1

Plugin API Version: 2

Reference Orphira Version: 1.2.6

## Core rule

Write against the public `api` object only.

Do not use Orphira source code, internal selectors, `window.state`, `window.api`, AudioEngine, StateManager, Electron, Node.js, `require()`, `fs` or `child_process`.

## Project

A normal plugin is a directory:

```text
my-plugin/
├── manifest.json
├── plugin.js
├── locales/
├── themes/
└── views/
````

Build it with:

text

```
npm run pack-plugin -- ./my-plugin
```

## Lifecycle

JavaScript

```
module.exports = {
  async activate(api) {
  },

  async deactivate() {
  }
};
```

Runtime registrations are owned by the plugin. Orphira cleans its registered UI and Layout state when the plugin is deactivated.

## Show a notification

Permission:

text

```
ui:notifications
```

JavaScript

```
await api.notifications.show(
  'Hello',
  'success'
);
```

Types are `info`, `success`, `warning` and `error`.

## Read the current track

Permission:

text

```
player:read
```

JavaScript

```
const track =
  await api.player.getCurrentTrack();

if (track) {
  console.log(
    track.title,
    track.artist
  );
}
```

Track DTOs never expose filesystem paths.

## Control playback

Permission:

text

```
player:control
```

JavaScript

```
await api.player.play();
await api.player.pause();
await api.player.next();
await api.player.previous();
await api.player.setVolume(75);
await api.player.setPlaybackRate(1.25);
```

## Listen for track changes

JavaScript

```
const dispose =
  api.events.on(
    'player.trackChanged',
    track => {
      console.log(track.title);
    }
  );
```

Call `dispose()` when your own code no longer needs the listener.

## Timeline

Permissions:

text

```
timeline:read
timeline:control
```

JavaScript

```
const timeline =
  await api.timeline.get();

await api.timeline.seek(
  60
);
```

`player.positionChanged` is throttled by Core.

## Library

Permission:

text

```
library:read
```

JavaScript

```
const tracks =
  await api.library.getTracks();

const track =
  await api.library.getTrack(
    tracks[0].id
  );
```

Only sanitized metadata is returned.

## Queue

Permissions:

text

```
queue:read
queue:write
```

JavaScript

```
const queue =
  await api.queue.get();

await api.queue.addNext([
  'track-id'
]);

await api.queue.addEnd([
  'track-id'
]);

await api.queue.clear();
```

## Playlists

Permissions:

text

```
playlists:read
playlists:write
```

JavaScript

```
const playlist =
  await api.playlists.create(
    'My Playlist'
  );

await api.playlists.addTracks(
  playlist.id,
  [
    'track-id'
  ]
);

await api.playlists.remove(
  playlist.id
);
```

## Equalizer

Read:

JavaScript

```
const eq =
  await api.equalizer.get();
```

Control:

JavaScript

```
await api.equalizer.setBand(
  0,
  4
);

await api.equalizer.setPreamp(
  -1
);

await api.equalizer.setQ(
  1.4
);

await api.equalizer.setBypass(
  false
);

await api.equalizer.applyPreset([
  4, 3, 2, 1, 0,
  0, 1, 2, 3, 4
]);
```

Read spectrum data:

JavaScript

```
const spectrum =
  await api.equalizer.getSpectrum();
```

Register a safe Core-rendered visualizer mode:

JavaScript

```
await api.equalizer.registerVisualizerMode({
  id: 'neon',
  name: 'Neon',
  type: 'bars',
  color: '#ff4fa3',
  secondaryColor: '#5b7cff'
});
```

Supported visualizer types are `bars`, `line` and `dots`.

`equalizer:presets` is reserved for the future `registerPreset()` extension point. Do not call `api.equalizer.registerPreset()` in API v2.0 because that method is not currently exposed.

## Lyrics

Permission:

text

```
lyrics:read
```

JavaScript

```
const lyrics =
  await api.lyrics.getCurrent();
```

Each item contains `time` and `text`.

## Private storage

Permission:

text

```
storage
```

JavaScript

```
await api.storage.set(
  'counter',
  1
);

const counter =
  await api.storage.get(
    'counter'
  );

await api.storage.delete(
  'counter'
);
```

Storage is isolated by plugin id.

A `password` Settings control only masks text visually. It is not an operating-system keychain or cryptographic Secret Storage.

## Network

Manifest:

JSON

```
{
  "permissions": [
    "network"
  ],
  "network": {
    "hosts": [
      "api.example.com"
    ]
  }
}
```

Request:

JavaScript

```
const response =
  await api.network.fetch({
    url: "https://api.example.com/data",
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });
```

Only HTTPS is accepted and Main Process checks the hostname allowlist.

## Player button

Permission:

text

```
ui:player
```

JavaScript

```
await api.ui.player.addAction({
  id: 'hello',
  title: 'Hello',
  icon: '◆',

  async onClick() {
    await api.notifications.show(
      'Clicked',
      'info'
    );
  }
});
```

## Sidebar button

Permission:

text

```
ui:sidebar
```

JavaScript

```
await api.ui.sidebar.addAction({
  id: 'dashboard',
  title: 'Dashboard',
  icon: '★',

  async onClick() {
    await api.ui.views.open(
      'dashboard'
    );
  }
});
```

## Track context action

Permission:

text

```
ui:context-menu
```

JavaScript

```
await api.ui.contextMenu.addTrackAction({
  id: 'inspect',
  title: 'Inspect',

  async onClick(context) {
    console.log(
      context.track.id
    );
  }
});
```

The provided track is sanitized.

## Settings

Permission:

text

```
ui:settings
```

JavaScript

```
await api.ui.settings.addSection({
  id: 'general',
  title: 'My Plugin',

  controls: [
    {
      id: 'enabled',
      type: 'toggle',
      label: 'Enabled',
      default: true,
      async onChange(event) {
        console.log(event.value);
      }
    },
    {
      id: 'mode',
      type: 'select',
      label: 'Mode',
      default: 'normal',
      options: [
        {
          value: 'normal',
          label: 'Normal'
        },
        {
          value: 'compact',
          label: 'Compact'
        }
      ]
    },
    {
      id: 'amount',
      type: 'slider',
      label: 'Amount',
      min: 0,
      max: 100,
      step: 1,
      default: 50
    },
    {
      id: 'name',
      type: 'text',
      label: 'Name',
      default: ''
    },
    {
      id: 'masked',
      type: 'password',
      label: 'Masked value',
      default: ''
    }
  ]
});
```

Supported control types:

text

```
toggle
text
password
select
slider
```

## Layout

Permission:

text

```
ui:layout
```

Discover public components:

JavaScript

```
const components =
  await api.ui.layout.getComponents();
```

Hide/show:

JavaScript

```
await api.ui.layout.hide(
  'player.equalizer'
);

await api.ui.layout.show(
  'player.equalizer'
);
```

Change order inside an approved container:

JavaScript

```
await api.ui.layout.setOrder(
  'player.center',
  [
    'player.timeline',
    'player.transport'
  ]
);
```

Register a preset:

JavaScript

```
await api.ui.layout.registerPreset({
  id: 'compact',
  name: 'Compact',
  hidden: [
    'player.equalizer',
    'player.speed'
  ],
  shown: [
    'player.volume'
  ],
  order: {
    'player.center': [
      'player.transport',
      'player.timeline'
    ]
  }
});
```

Apply it:

JavaScript

```
await api.ui.layout.applyPreset(
  'compact'
);
```

Restore this plugin's layout modifications:

JavaScript

```
await api.ui.layout.reset();
```

Never use `document.querySelector()` against Orphira. Component IDs are the stable contract.

## Theme

Permission:

text

```
themes:register
```

Manifest:

JSON

```
{
  "contributes": {
    "themes": [
      {
        "id": "midnight",
        "name": "Midnight",
        "file": "themes/midnight.css"
      }
    ]
  }
}
```

Theme:

CSS

```
:root {
  --accent-pink: #ff00aa;
  --accent-cyan: #00ddff;
}
```

Theme contributions appear in Orphira Appearance settings.

## Locale contribution

Permission:

text

```
locales:register
```

Manifest:

JSON

```
{
  "contributes": {
    "locales": [
      {
        "language": "en",
        "file": "locales/en.json"
      }
    ]
  }
}
```

Locale:

JSON

```
{
  "title": "My Plugin"
}
```

Core namespaces the dictionary as:

text

```
plugin.<plugin-id>.title
```

Plugin locale contributions cannot overwrite Core locale keys.

## Custom view

Permission:

text

```
ui:views
```

Manifest:

JSON

```
{
  "contributes": {
    "views": [
      {
        "id": "dashboard",
        "title": "Dashboard",
        "file": "views/dashboard.html"
      }
    ]
  }
}
```

Open:

JavaScript

```
await api.ui.views.open(
  'dashboard'
);
```

The view runs sandboxed and cannot inspect Orphira DOM.

## Commands

Permission:

text

```
ui:commands
```

JavaScript

```
await api.commands.register({
  id: 'do-something',
  title: 'Do Something',

  async onExecute() {
  }
});
```

Commands are registered in Core. A visual command palette is planned separately.

## Events

Available API v2 events include:

text

```
app.ready
app.languageChanged
player.trackChanged
player.stateChanged
player.positionChanged
player.durationChanged
player.seekStarted
player.seekEnded
player.ended
player.playbackRateChanged
queue.changed
playlists.changed
library.ready
lyrics.changed
equalizer.changed
theme.changed
```

## Reserved provider permissions

These manifest permissions are reserved:

text

```
providers:metadata
providers:lyrics
providers:artwork
```

The Provider Registry is not implemented yet. They do not currently provide a registration method.

## Security

Never request a permission you do not use.

Plugins cannot receive unrestricted filesystem, Electron, Node.js, internal DOM or arbitrary network access.

When an extension needs a missing capability, Orphira should add a stable public extension point instead of exposing an internal object.

text

````

SDK теперь является практическим Cookbook.

FILE: PLUGIN-API-REFERENCE.md
Изменение: новый строгий reference фактически работающего API v2.

Создай файл целиком:

```markdown
# Orphira Plugin API Reference

API Version: 2

Manifest Version: 1

## PublicTrack

```text
{
  id: string
  title: string
  artist: string
  album: string
  duration: number
  year: number|string|null
  genre: string|null
  trackNumber: number|null
  discNumber: number|null
}
````

Filesystem paths are not public.

## App

`api.app.getInfo()`

Permission: none.

Returns application name, version, Plugin API version and active language.

## Player

`api.player.getCurrentTrack()`

Permission: `player:read`.

Returns `PublicTrack | null`.

`api.player.getState()`

Permission: `player:read`.

Returns playback state including playing state, time, duration, volume, playback rate, shuffle and repeat.

`api.player.play()`

`api.player.pause()`

`api.player.next()`

`api.player.previous()`

`api.player.setVolume(value)`

`api.player.setPlaybackRate(value)`

Permission: `player:control`.

Volume is clamped to 0–100. Playback rate is clamped to 0.2–2.0.

## Timeline

`api.timeline.get()`

Permission: `timeline:read`.

`api.timeline.seek(seconds)`

Permission: `timeline:control`.

## Queue

`api.queue.get()`

Permission: `queue:read`.

`api.queue.addNext(trackIds)`

`api.queue.addEnd(trackIds)`

`api.queue.clear()`

Permission: `queue:write`.

## Library

`api.library.getTracks()`

`api.library.getTrack(trackId)`

Permission: `library:read`.

## Playlists

`api.playlists.get()`

Permission: `playlists:read`.

`api.playlists.create(name)`

`api.playlists.remove(playlistId)`

`api.playlists.addTracks(playlistId, trackIds)`

Permission: `playlists:write`.

## Equalizer

`api.equalizer.get()`

Permission: `equalizer:read`.

`api.equalizer.setBand(index, gain)`

`api.equalizer.setPreamp(value)`

`api.equalizer.setQ(value)`

`api.equalizer.setBypass(value)`

`api.equalizer.applyPreset(gains)`

Permission: `equalizer:control`.

EQ band index is 0–9. Gain values are clamped to -12–12 dB.

`api.equalizer.getSpectrum()`

`api.equalizer.registerVisualizerMode(definition)`

Permission: `equalizer:visualizer`.

Visualizer types: `bars`, `line`, `dots`.

`equalizer:presets` is reserved. `api.equalizer.registerPreset()` is not currently exposed.

## Lyrics

`api.lyrics.getCurrent()`

Permission: `lyrics:read`.

Returns:

text

```
Array<{
  time: number,
  text: string
}>
```

## Storage

`api.storage.get(key)`

`api.storage.set(key, value)`

`api.storage.delete(key)`

Permission: `storage`.

Storage belongs to the calling plugin.

## Network

`api.network.fetch(options)`

Permission: `network`.

Options:

text

```
{
  url: string
  method?: GET|POST|PUT|PATCH|DELETE|HEAD
  headers?: object
  body?: string|null
}
```

Only HTTPS is accepted. Hostnames must match the manifest allowlist.

Returns:

text

```
{
  status: number
  headers: object
  body: string
}
```

## Notifications

`api.notifications.show(message, type?)`

Permission: `ui:notifications`.

Types: `info`, `success`, `warning`, `error`.

## Commands

`api.commands.register(definition)`

Permission: `ui:commands`.

Definition:

text

```
{
  id: string
  title: string
  onExecute?: async function
}
```

## Player UI

`api.ui.player.addAction(definition)`

Permission: `ui:player`.

## Sidebar UI

`api.ui.sidebar.addAction(definition)`

Permission: `ui:sidebar`.

## Context menu

`api.ui.contextMenu.addTrackAction(definition)`

Permission: `ui:context-menu`.

Callback receives a sanitized `PublicTrack`.

## Settings

`api.ui.settings.addSection(definition)`

Permission: `ui:settings`.

Controls:

text

```
toggle
text
password
select
slider
```

Password is a masked input, not secure keychain storage.

## Views

`api.ui.views.open(viewId)`

Permission: `ui:views`.

View must be declared by the plugin manifest.

## Layout

All Layout calls require `ui:layout`.

`api.ui.layout.getComponents()`

Returns discoverable public component descriptors.

`api.ui.layout.hide(componentId)`

`api.ui.layout.show(componentId)`

`api.ui.layout.move(componentId, containerId)`

Movement is restricted to Core-approved containers.

`api.ui.layout.setOrder(containerId, componentIds)`

`api.ui.layout.registerPreset(definition)`

`api.ui.layout.applyPreset(presetId)`

`api.ui.layout.reset()`

Reset removes layout state owned by the calling plugin. Deactivation also cleans plugin-owned layout state.

## Events

`api.events.on(eventName, handler)`

Returns a disposer function.

Known events:

text

```
app.ready
app.languageChanged
player.trackChanged
player.stateChanged
player.positionChanged
player.durationChanged
player.seekStarted
player.seekEnded
player.ended
player.playbackRateChanged
queue.changed
playlists.changed
library.ready
lyrics.changed
equalizer.changed
theme.changed
```

## Manifest-only contributions

Themes require `themes:register`.

Locales require `locales:register`.

Views require `ui:views`.

## Reserved API surface

The following permissions are recognized by manifests but their provider registry is not implemented:

text

```
providers:metadata
providers:lyrics
providers:artwork
```

Do not depend on provider registration until a future API revision documents the contract.

## Security boundary

Plugin code must never depend on:

text

```
window.state
window.api
Orphira DOM
Node.js
Electron
require()
fs
child_process
absolute media paths
unapproved network hosts
```