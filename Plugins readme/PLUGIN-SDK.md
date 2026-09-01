# Orphira Plugin SDK

Manifest Version: 1
Plugin API Version: 2
Reference Orphira Version: 1.2.6

## Core rule

An Orphira plugin knows only this API.

Never use or depend on:

- window.state
- window.api
- document elements from Orphira
- internal CSS selectors
- AudioEngine
- StateManager
- Electron
- Node.js
- require()
- fs
- child_process
- internal Orphira files

Plugin JavaScript runs inside an isolated sandbox.

## Package

A plugin is one UTF-8 JSON file:

`name.orphira-plugin`

Format:

```json
{
  "manifest": {
    "manifestVersion": 1,
    "id": "com.example.plugin",
    "name": "Example",
    "version": "1.0.0",
    "description": "Example plugin",
    "author": "Developer",
    "license": "MIT",
    "orphira": {
      "apiVersion": 2,
      "minimumVersion": "1.2.6"
    },
    "entry": "plugin.js",
    "permissions": [],
    "network": {
      "hosts": []
    },
    "contributes": {
      "commands": [],
      "themes": [],
      "locales": [],
      "views": []
    }
  },
  "files": {
    "plugin.js": "module.exports = { async activate(api) {}, async deactivate() {} };"
  }
}
````

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

## Permissions

Available permissions:

text

```
player:read
player:control
timeline:read
timeline:control

queue:read
queue:write

library:read

playlists:read
playlists:write

equalizer:read
equalizer:control
equalizer:presets
equalizer:visualizer

lyrics:read

storage
network

ui:notifications
ui:commands
ui:settings
ui:player
ui:sidebar
ui:context-menu
ui:views

themes:register
locales:register

providers:metadata
providers:lyrics
providers:artwork
```

## App

JavaScript

```
const info =
  await api.app.getInfo();
```

Returns:

JavaScript

```
{
  name,
  version,
  pluginApiVersion,
  language
}
```

## Player

Read:

JavaScript

```
const track =
  await api.player.getCurrentTrack();

const state =
  await api.player.getState();
```

Control:

JavaScript

```
await api.player.play();
await api.player.pause();
await api.player.next();
await api.player.previous();

await api.player.setVolume(70);
await api.player.setPlaybackRate(1.25);
```

Filesystem paths are never exposed in public track objects.

## Timeline

JavaScript

```
const timeline =
  await api.timeline.get();

await api.timeline.seek(90);
```

Events:

text

```
player.positionChanged
player.durationChanged
player.seekStarted
player.seekEnded
player.ended
```

Example:

JavaScript

```
api.events.on(
  'player.positionChanged',
  event => {
    console.log(
      event.currentTime
    );
  }
);
```

## Queue

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

Event:

text

```
queue.changed
```

## Library

JavaScript

```
const tracks =
  await api.library.getTracks();

const track =
  await api.library.getTrack(
    'track-id'
  );
```

Only public metadata is returned.

No absolute music-file path is exposed.

## Playlists

JavaScript

```
const playlists =
  await api.playlists.get();

const playlist =
  await api.playlists.create(
    'Favorites'
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

Event:

text

```
playlists.changed
```

## Equalizer

Read configuration:

JavaScript

```
const eq =
  await api.equalizer.get();
```

Change a band:

JavaScript

```
await api.equalizer.setBand(
  0,
  5.5
);
```

Band indexes:

text

```
0 = 32 Hz
1 = 64 Hz
2 = 125 Hz
3 = 250 Hz
4 = 500 Hz
5 = 1 kHz
6 = 2 kHz
7 = 4 kHz
8 = 8 kHz
9 = 16 kHz
```

Other controls:

JavaScript

```
await api.equalizer.setPreamp(
  -2
);

await api.equalizer.setQ(
  1.4
);

await api.equalizer.setBypass(
  false
);

await api.equalizer.applyPreset([
  4,
  3,
  2,
  0,
  0,
  0,
  1,
  2,
  3,
  4
]);
```

Spectrum data:

JavaScript

```
const spectrum =
  await api.equalizer.getSpectrum();
```

## Custom EQ visualizer

A plugin does not receive Orphira's Canvas.

Instead it registers a rendering mode:

JavaScript

```
await api.equalizer
  .registerVisualizerMode({
    id: 'neon-bars',
    name: 'Neon Bars',
    type: 'bars',
    color: '#ff4fa3',
    secondaryColor: '#5b7cff'
  });
```

Types:

text

```
bars
line
dots
```

The mode appears in Orphira's EQ graph mode switcher.

This allows visual customization without exposing internal DOM.

## Lyrics

JavaScript

```
const lyrics =
  await api.lyrics.getCurrent();
```

Result:

JavaScript

```
[
  {
    time: 12.4,
    text: "..."
  }
]
```

Event:

text

```
lyrics.changed
```

## Storage

Every plugin has isolated private storage:

JavaScript

```
await api.storage.set(
  'key',
  value
);

const value =
  await api.storage.get(
    'key'
  );

await api.storage.delete(
  'key'
);
```

A plugin cannot access another plugin's storage.

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
      "api.example.com",
      "*.example.org"
    ]
  }
}
```

Request:

JavaScript

```
const response =
  await api.network.fetch({
    url:
      "https://api.example.com/data",
    method:
      "GET",
    headers: {
      "Accept":
        "application/json"
    }
  });
```

Only HTTPS is accepted.

A hostname absent from the manifest is rejected by Orphira Main Process.

## Notifications

JavaScript

```
await api.notifications.show(
  'Hello',
  'success'
);
```

Types:

text

```
info
success
warning
error
```

## Player UI actions

JavaScript

```
await api.ui.player.addAction({
  id: 'sleep',
  title: 'Sleep Timer',
  icon: '◷',

  async onClick() {
    await api.notifications.show(
      'Clicked',
      'info'
    );
  }
});
```

The plugin does not know where the player button physically exists.

Orphira owns placement.

## Sidebar actions

JavaScript

```
await api.ui.sidebar.addAction({
  id: 'example',
  title: 'Example',
  icon: '★',

  async onClick() {
  }
});
```

## Track context menu

JavaScript

```
await api.ui.contextMenu
  .addTrackAction({
    id: 'example',
    title: 'Example Action',

    async onClick(context) {
      console.log(
        context.track.id
      );
    }
  });
```

The track object is sanitized.

## Plugin settings

JavaScript

```
await api.ui.settings.addSection({
  id: 'general',
  title: 'Example Plugin',

  controls: [
    {
      id: 'enabled',
      type: 'toggle',
      label: 'Enabled',
      description:
        'Enable this feature',
      default: true,

      async onChange(event) {
        console.log(
          event.value
        );
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
          value: 'strong',
          label: 'Strong'
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
      id: 'secret',
      type: 'password',
      label: 'API key',
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

Values are stored inside the plugin's isolated storage.

## Themes

Manifest:

JSON

```
{
  "permissions": [
    "themes:register"
  ],
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

Package:

JSON

```
{
  "files": {
    "themes/midnight.css":
      ":root { --accent-pink: #ff00aa; --accent-cyan: #00ddff; }"
  }
}
```

Plugin themes appear in:

text

```
Settings
→ Appearance
→ Theme
```

## Plugin locales

Manifest:

JSON

```
{
  "permissions": [
    "locales:register"
  ],
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

Plugin locale:

JSON

```
{
  "title": "Example"
}
```

Orphira namespaces the key automatically:

text

```
plugin.com.example.plugin.title
```

A plugin cannot replace Core translation keys.

## Custom views

Manifest:

JSON

```
{
  "permissions": [
    "ui:views"
  ],
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

Open it:

JavaScript

```
await api.ui.views.open(
  'dashboard'
);
```

The custom view runs in its own sandbox.

It cannot read Orphira DOM.

## Events

Available events include:

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

Listen:

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

Stop listening:

JavaScript

```
dispose();
```

## Security model

Plugin JavaScript does not have access to:

text

```
Node.js
Electron
require()
fs
child_process
Orphira window.api
Orphira window.state
Orphira DOM
arbitrary filesystem paths
arbitrary internet hosts
other plugin storage
```

A plugin cannot simply read:

text

```
C:\Users\User\secret.txt
```

because no filesystem API exists inside the sandbox.

Network requests must go through:

JavaScript

```
api.network.fetch()
```

and Main Process checks the manifest hostname allowlist.

## Architecture rule

When a new category of Orphira functionality is required, add a stable extension point to Plugin API.

Do not teach plugins Orphira internals.

That guarantees that an AI assistant normally needs only:

text

```
PLUGIN-SDK.md
```

to create a plugin.

## AI development instruction

When generating an Orphira plugin:

1. Use only APIs documented here.
2. Never assume access to Orphira source code.
3. Request only necessary permissions.
4. Never use Node.js or Electron.
5. Never reference internal DOM selectors.
6. Put all user-facing plugin strings in plugin locale files when localization is needed.
7. Return a complete `.orphira-plugin` package.