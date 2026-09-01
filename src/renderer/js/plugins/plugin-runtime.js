class OrphiraPluginRuntime {
 constructor() {
 this.instances = new Map();

 this.commands = new Map();
 this.settings = new Map();
 this.playerActions = new Map();
 this.contextActions = new Map();
 this.sidebarActions = new Map();
 this.themes = new Map();
 this.eqModes = new Map();
 this.views = new Map();

 this.ready = false;

 this._messageHandler =
 this._onMessage.bind(this);
 }

 async init() {
 if (this.ready) {
 return;
 }

 window.addEventListener(
 'message',
 this._messageHandler
 );

 const descriptors =
 await window.api.plugins
 .getEnabled();

 for (
 const descriptor
 of descriptors
 ) {
 try {
 await this.activate(
 descriptor
 );
 } catch (error) {
 console.error(
 `[Plugin:${descriptor.id}]`,
 error
 );
 }
 }

 this.ready = true;

 this.refreshUI();

 this.emit(
 'app.ready',
 {
 version:
 window.state?.appVersion ||
 '',
 apiVersion: 2
 }
 );
 }

 _makeDocument(
 pluginId,
 source
 ) {
 const safePluginId =
 JSON.stringify(
 String(pluginId)
 );

 const safeSource =
 String(source || '')
 .replace(
 /<\/script/gi,
 '<\\/script'
 );

 return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta
 http-equiv="Content-Security-Policy"
 content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none';"
>
<style>
html,
body {
 margin: 0;
 padding: 0;
 width: 100%;
 height: 100%;
 background: transparent;
 color: #ffffff;
 font-family: system-ui, sans-serif;
}
</style>
</head>
<body>
<script>
(() => {
 'use strict';

 const PLUGIN_ID =
 ${safePluginId};

 let sequence = 0;

 const pending =
 new Map();

 const events =
 new Map();

 const callbacks =
 new Map();

 const lifecycle = {
 exported: null,
 activated: false,
 deactivated: false
 };

 const makeCloneSafe =
 value => {
 if (
 value === null ||
 value === undefined
 ) {
 return value;
 }

 const valueType =
 typeof value;

 if (
 valueType === 'string' ||
 valueType === 'number' ||
 valueType === 'boolean'
 ) {
 return value;
 }

 if (
 valueType === 'function' ||
 valueType === 'symbol' ||
 valueType === 'bigint'
 ) {
 return undefined;
 }

 if (
 Array.isArray(value)
 ) {
 return value
 .map(
 item =>
 makeCloneSafe(item)
 )
 .filter(
 item =>
 item !== undefined
 );
 }

 if (
 valueType === 'object'
 ) {
 const result = {};

 for (
 const [key, item]
 of Object.entries(value)
 ) {
 const safeItem =
 makeCloneSafe(item);

 if (
 safeItem !== undefined
 ) {
 result[key] =
 safeItem;
 }
 }

 return result;
 }

 return undefined;
 };

 const send =
 data => {
 const safeData =
 makeCloneSafe(
 data || {}
 ) || {};

 parent.postMessage(
 {
 __orphiraPlugin: true,
 pluginId: PLUGIN_ID,
 ...safeData
 },
 '*'
 );
 };

 const request = (
 method,
 args = {}
 ) => {
 if (
 lifecycle.deactivated
 ) {
 return Promise.reject(
 new Error(
 'Plugin is deactivated.'
 )
 );
 }

 return new Promise(
 (resolve, reject) => {
 const requestId =
 PLUGIN_ID +
 ':' +
 (++sequence) +
 ':' +
 Date.now();

 pending.set(
 requestId,
 {
 resolve,
 reject
 }
 );

 send({
 type: 'api-request',
 requestId,
 method:
 String(method),
 args:
 makeCloneSafe(args) || {}
 });
 }
 );
 };

 const registerCallback =
 callback => {
 if (
 typeof callback !==
 'function'
 ) {
 return null;
 }

 const callbackId =
 'callback:' +
 (++sequence) +
 ':' +
 Date.now();

 callbacks.set(
 callbackId,
 callback
 );

 return callbackId;
 };

 const onEvent = (
 eventName,
 handler
 ) => {
 if (
 typeof handler !==
 'function'
 ) {
 throw new TypeError(
 'Event handler must be a function.'
 );
 }

 const name =
 String(eventName);

 if (
 !events.has(name)
 ) {
 events.set(
 name,
 new Set()
 );
 }

 events
 .get(name)
 .add(handler);

 return () => {
 events
 .get(name)
 ?.delete(handler);
 };
 };

 const api =
 Object.freeze({
 app:
 Object.freeze({
 getInfo: () =>
 request(
 'app.getInfo'
 )
 }),

 player:
 Object.freeze({
 getCurrentTrack: () =>
 request(
 'player.getCurrentTrack'
 ),

 getState: () =>
 request(
 'player.getState'
 ),

 play: () =>
 request(
 'player.play'
 ),

 pause: () =>
 request(
 'player.pause'
 ),

 next: () =>
 request(
 'player.next'
 ),

 previous: () =>
 request(
 'player.previous'
 ),

 setVolume: value =>
 request(
 'player.setVolume',
 {
 value
 }
 ),

 setPlaybackRate: value =>
 request(
 'player.setPlaybackRate',
 {
 value
 }
 )
 }),

 timeline:
 Object.freeze({
 get: () =>
 request(
 'timeline.get'
 ),

 seek: seconds =>
 request(
 'timeline.seek',
 {
 seconds
 }
 )
 }),

 queue:
 Object.freeze({
 get: () =>
 request(
 'queue.get'
 ),

 addNext: trackIds =>
 request(
 'queue.addNext',
 {
 trackIds
 }
 ),

 addEnd: trackIds =>
 request(
 'queue.addEnd',
 {
 trackIds
 }
 ),

 clear: () =>
 request(
 'queue.clear'
 )
 }),

 library:
 Object.freeze({
 getTracks: () =>
 request(
 'library.getTracks'
 ),

 getTrack: trackId =>
 request(
 'library.getTrack',
 {
 trackId
 }
 )
 }),

 playlists:
 Object.freeze({
 get: () =>
 request(
 'playlists.get'
 ),

 create: name =>
 request(
 'playlists.create',
 {
 name
 }
 ),

 remove: playlistId =>
 request(
 'playlists.remove',
 {
 playlistId
 }
 ),

 addTracks:
 (
 playlistId,
 trackIds
 ) =>
 request(
 'playlists.addTracks',
 {
 playlistId,
 trackIds
 }
 )
 }),

 equalizer:
 Object.freeze({
 get: () =>
 request(
 'equalizer.get'
 ),

 setBand:
 (
 index,
 gain
 ) =>
 request(
 'equalizer.setBand',
 {
 index,
 gain
 }
 ),

 setPreamp: value =>
 request(
 'equalizer.setPreamp',
 {
 value
 }
 ),

 setQ: value =>
 request(
 'equalizer.setQ',
 {
 value
 }
 ),

 setBypass: value =>
 request(
 'equalizer.setBypass',
 {
 value
 }
 ),

 applyPreset: gains =>
 request(
 'equalizer.applyPreset',
 {
 gains
 }
 ),

 getSpectrum: () =>
 request(
 'equalizer.getSpectrum'
 ),

 registerVisualizerMode:
 definition =>
 request(
 'equalizer.registerVisualizerMode',
 makeCloneSafe(
 definition || {}
 )
 )
 }),

 lyrics:
 Object.freeze({
 getCurrent: () =>
 request(
 'lyrics.getCurrent'
 )
 }),

 storage:
 Object.freeze({
 get: key =>
 request(
 'storage.get',
 {
 key
 }
 ),

 set:
 (
 key,
 value
 ) =>
 request(
 'storage.set',
 {
 key,
 value
 }
 ),

 delete: key =>
 request(
 'storage.delete',
 {
 key
 }
 )
 }),

 network:
 Object.freeze({
 fetch: options =>
 request(
 'network.fetch',
 makeCloneSafe(
 options || {}
 )
 )
 }),

 notifications:
 Object.freeze({
 show:
 (
 message,
 type = 'info'
 ) =>
 request(
 'notifications.show',
 {
 message,
 type
 }
 )
 }),

 commands:
 Object.freeze({
 register:
 definition => {
 const source =
 definition &&
 typeof definition ===
 'object'
 ? definition
 : {};

 const {
 onExecute,
 ...definitionData
 } = source;

 return request(
 'commands.register',
 {
 ...makeCloneSafe(
 definitionData
 ),
 callbackId:
 registerCallback(
 onExecute
 )
 }
 );
 }
 }),

 ui:
 Object.freeze({
 player:
 Object.freeze({
 addAction:
 definition => {
 const source =
 definition &&
 typeof definition ===
 'object'
 ? definition
 : {};

 const {
 onClick,
 ...definitionData
 } = source;

 return request(
 'ui.player.addAction',
 {
 ...makeCloneSafe(
 definitionData
 ),
 callbackId:
 registerCallback(
 onClick
 )
 }
 );
 }
 }),

 sidebar:
 Object.freeze({
 addAction:
 definition => {
 const source =
 definition &&
 typeof definition ===
 'object'
 ? definition
 : {};

 const {
 onClick,
 ...definitionData
 } = source;

 return request(
 'ui.sidebar.addAction',
 {
 ...makeCloneSafe(
 definitionData
 ),
 callbackId:
 registerCallback(
 onClick
 )
 }
 );
 }
 }),

 contextMenu:
 Object.freeze({
 addTrackAction:
 definition => {
 const source =
 definition &&
 typeof definition ===
 'object'
 ? definition
 : {};

 const {
 onClick,
 ...definitionData
 } = source;

 return request(
 'ui.contextMenu.addTrackAction',
 {
 ...makeCloneSafe(
 definitionData
 ),
 callbackId:
 registerCallback(
 onClick
 )
 }
 );
 }
 }),

 settings:
 Object.freeze({
 addSection:
 definition => {
 const source =
 definition &&
 typeof definition ===
 'object'
 ? definition
 : {};

 const {
 controls:
 rawControls,
 ...sectionData
 } = source;

 const controls =
 Array.isArray(
 rawControls
 )
 ? rawControls.map(
 control => {
 const controlSource =
 control &&
 typeof control ===
 'object'
 ? control
 : {};

 const {
 onChange,
 ...controlData
 } =
 controlSource;

 return {
 ...makeCloneSafe(
 controlData
 ),
 callbackId:
 registerCallback(
 onChange
 )
 };
 }
 )
 : [];

 return request(
 'ui.settings.addSection',
 {
 ...makeCloneSafe(
 sectionData
 ),
 controls
 }
 );
 }
 }),

 views:
 Object.freeze({
 open: viewId =>
 request(
 'ui.views.open',
 {
 viewId
 }
 )
 }),
 layout:
 Object.freeze({
 getComponents: () =>
 request(
 'ui.layout.getComponents'
 ),
 hide: componentId =>
 request(
 'ui.layout.hide',
 {
 componentId
 }
 ),
 show: componentId =>
 request(
 'ui.layout.show',
 {
 componentId
 }
 ),
 move:
 (
 componentId,
 containerId
 ) =>
 request(
 'ui.layout.move',
 {
 componentId,
 containerId
 }
 ),
 setOrder:
 (
 containerId,
 componentIds
 ) =>
 request(
 'ui.layout.setOrder',
 {
 containerId,
 componentIds
 }
 ),
 registerPreset:
 definition =>
 request(
 'ui.layout.registerPreset',
 makeCloneSafe(
 definition || {}
 )
 ),
 applyPreset: presetId =>
 request(
 'ui.layout.applyPreset',
 {
 presetId
 }
 ),
 reset: () =>
 request(
 'ui.layout.reset'
 )
 })
 }),

 events:
 Object.freeze({
 on: onEvent
 })
 });

 window.__orphiraPluginBootstrap =
 Object.freeze({
 api,

 setExports:
 exported => {
 lifecycle.exported =
 exported &&
 typeof exported ===
 'object'
 ? exported
 : {};
 },

 activate:
 async () => {
 if (
 lifecycle.activated ||
 lifecycle.deactivated
 ) {
 return;
 }

 const exported =
 lifecycle.exported || {};

 if (
 typeof exported.activate ===
 'function'
 ) {
 await exported.activate(
 api
 );
 }

 lifecycle.activated =
 true;

 send({
 type: 'activated'
 });
 },

 deactivate:
 async () => {
 if (
 lifecycle.deactivated
 ) {
 send({
 type: 'deactivated'
 });

 return;
 }

 lifecycle.deactivated =
 true;

 const exported =
 lifecycle.exported || {};

 if (
 typeof exported.deactivate ===
 'function'
 ) {
 await exported.deactivate();
 }

 events.clear();
 callbacks.clear();

 for (
 const entry
 of pending.values()
 ) {
 entry.reject(
 new Error(
 'Plugin deactivated.'
 )
 );
 }

 pending.clear();

 send({
 type: 'deactivated'
 });
 }
 });

 window.addEventListener(
 'message',
 async event => {
 const message =
 event.data;

 if (
 !message ||
 message.__orphiraHost !==
 true ||
 message.pluginId !==
 PLUGIN_ID
 ) {
 return;
 }

 if (
 message.type ===
 'api-response'
 ) {
 const entry =
 pending.get(
 message.requestId
 );

 if (!entry) {
 return;
 }

 pending.delete(
 message.requestId
 );

 if (message.ok) {
 entry.resolve(
 message.result
 );
 } else {
 entry.reject(
 new Error(
 message.error ||
 'Plugin API request failed.'
 )
 );
 }

 return;
 }

 if (
 message.type ===
 'event'
 ) {
 const handlers =
 events.get(
 message.eventName
 );

 if (!handlers) {
 return;
 }

 for (
 const handler
 of [...handlers]
 ) {
 try {
 await handler(
 message.payload
 );
 } catch (error) {
 console.error(
 '[Orphira Plugin Event]',
 error
 );
 }
 }

 return;
 }

 if (
 message.type ===
 'callback'
 ) {
 const callback =
 callbacks.get(
 message.callbackId
 );

 if (!callback) {
 send({
 type:
 'callback-result',
 callId:
 message.callId,
 ok: false,
 error:
 'Plugin callback does not exist.'
 });

 return;
 }

 try {
 const result =
 await callback(
 message.payload
 );

 send({
 type:
 'callback-result',
 callId:
 message.callId,
 ok: true,
 result:
 makeCloneSafe(result)
 });
 } catch (error) {
 send({
 type:
 'callback-result',
 callId:
 message.callId,
 ok: false,
 error:
 error?.message ||
 String(error)
 });
 }

 return;
 }

 if (
 message.type ===
 'lifecycle-deactivate'
 ) {
 try {
 await window
 .__orphiraPluginBootstrap
 .deactivate();
 } catch (error) {
 send({
 type:
 'deactivation-error',
 error:
 error?.message ||
 String(error)
 });
 }

 return;
 }
 }
 );

 window.addEventListener(
 'error',
 event => {
 send({
 type: 'runtime-error',
 error:
 event.error?.stack ||
 event.message ||
 'Unknown plugin error'
 });
 }
 );

 window.addEventListener(
 'unhandledrejection',
 event => {
 send({
 type: 'runtime-error',
 error:
 event.reason?.stack ||
 event.reason?.message ||
 String(
 event.reason
 )
 });
 }
 );
})();
<\/script>

<script>
(() => {
 'use strict';

 const module = {
 exports: {}
 };

 const exports =
 module.exports;

 try {
${safeSource}

 window
 .__orphiraPluginBootstrap
 .setExports(
 module.exports
 );

 Promise.resolve(
 window
 .__orphiraPluginBootstrap
 .activate()
 ).catch(
 error => {
 parent.postMessage(
 {
 __orphiraPlugin: true,
 type:
 'activation-error',
 pluginId:
 ${safePluginId},
 error:
 error?.stack ||
 String(error)
 },
 '*'
 );
 }
 );
 } catch (error) {
 parent.postMessage(
 {
 __orphiraPlugin: true,
 type:
 'activation-error',
 pluginId:
 ${safePluginId},
 error:
 error?.stack ||
 String(error)
 },
 '*'
 );
 }
})();
<\/script>
</body>
</html>`;
 }

 async activate(
 descriptor
 ) {
 if (
 !descriptor?.enabled ||
 !descriptor
 ?.manifest
 ?.id
 ) {
 return;
 }

 const pluginId =
 descriptor.manifest.id;

 if (
 this.instances.has(
 pluginId
 )
 ) {
 await this.deactivate(
 pluginId
 );
 }

 window.OrphiraPluginApi
 .register(
 pluginId,
 descriptor
 .manifest
 .permissions ||
 []
 );

 this._loadLocales(
 pluginId,
 descriptor
 );

 this._loadThemes(
 pluginId,
 descriptor
 );

 this._loadManifestContributions(
 pluginId,
 descriptor
 );

 const iframe =
 document.createElement(
 'iframe'
 );

 iframe.className =
 'orphira-plugin-sandbox';

 iframe.setAttribute(
 'sandbox',
 'allow-scripts'
 );

 iframe.tabIndex = -1;

 const instance = {
 descriptor,
 iframe,
 pendingCallbacks:
 new Map()
 };

 this.instances.set(
 pluginId,
 instance
 );

 iframe.srcdoc =
 this._makeDocument(
 pluginId,
 descriptor.source
 );

 document.body
 .appendChild(iframe);
 }

 async deactivate(
 pluginId
 ) {
 const instance =
 this.instances.get(
 pluginId
 );

 if (!instance) {
 return;
 }

 const frameWindow =
 instance.iframe
 ?.contentWindow;

 if (frameWindow) {
 await new Promise(
 resolve => {
 let finished = false;

 let timeout = null;

 const finish = () => {
 if (finished) {
 return;
 }

 finished = true;

 window.removeEventListener(
 'message',
 onLifecycleMessage
 );

 if (timeout) {
 clearTimeout(timeout);
 }

 resolve();
 };

 const onLifecycleMessage =
 event => {
 if (
 event.source !==
 frameWindow
 ) {
 return;
 }

 const message =
 event.data;

 if (
 !message ||
 message.__orphiraPlugin !==
 true ||
 message.pluginId !==
 pluginId
 ) {
 return;
 }

 if (
 message.type ===
 'deactivated' ||
 message.type ===
 'deactivation-error'
 ) {
 finish();
 }
 };

 window.addEventListener(
 'message',
 onLifecycleMessage
 );

 timeout =
 setTimeout(
 finish,
 1500
 );

 frameWindow.postMessage(
 {
 __orphiraHost: true,
 type:
 'lifecycle-deactivate',
 pluginId
 },
 '*'
 );
 }
 );
 }

 this.instances.delete(
 pluginId
 );
 window.OrphiraPluginLayout
 ?.unregisterPlugin(
 pluginId
 );
 window.OrphiraPluginApi
 .unregister(
 pluginId
 );

 this._removeOwned(
 this.commands,
 pluginId
 );

 this._removeOwned(
 this.settings,
 pluginId
 );

 this._removeOwned(
 this.playerActions,
 pluginId
 );

 this._removeOwned(
 this.contextActions,
 pluginId
 );

 this._removeOwned(
 this.sidebarActions,
 pluginId
 );

 this._removeOwned(
 this.themes,
 pluginId
 );

 this._removeOwned(
 this.eqModes,
 pluginId
 );

 this._removeOwned(
 this.views,
 pluginId
 );

 for (
 const pending
 of instance
 .pendingCallbacks
 .values()
 ) {
 clearTimeout(
 pending.timeout
 );

 pending.reject(
 new Error(
 'Plugin deactivated.'
 )
 );
 }

 instance
 .pendingCallbacks
 .clear();

 instance.iframe
 .remove();

 this.refreshUI();

 window.EQVisualizer
 ?.refreshPluginModes?.();
 }

 _removeOwned(
 map,
 pluginId
 ) {
 for (
 const [id, value]
 of [...map.entries()]
 ) {
 if (
 value.pluginId ===
 pluginId
 ) {
 map.delete(id);
 }
 }
 }

 _loadLocales(
 pluginId,
 descriptor
 ) {
 if (
 !descriptor.manifest
 .permissions
 ?.includes(
 'locales:register'
 )
 ) {
 return;
 }

 for (
 const [language, dictionary]
 of Object.entries(
 descriptor.locales ||
 {}
 )
 ) {
 window.i18n.locales[
 language
 ] =
 window.i18n.locales[
 language
 ] || {};

 for (
 const [key, value]
 of Object.entries(
 dictionary
 )
 ) {
 window.i18n.locales[
 language
 ][
 `plugin.${pluginId}.${key}`
 ] =
 String(value);
 }
 }
 }

 _loadThemes(
 pluginId,
 descriptor
 ) {
 if (
 !descriptor.manifest
 .permissions
 ?.includes(
 'themes:register'
 )
 ) {
 return;
 }

 for (
 const theme
 of descriptor.themes ||
 []
 ) {
 const id =
 `${pluginId}.${theme.id}`;

 this.themes.set(
 id,
 {
 pluginId,
 id,
 name:
 String(theme.name),
 css:
 String(
 theme.css || ''
 )
 }
 );
 }
 }

 _loadManifestContributions(
 pluginId,
 descriptor
 ) {
 const contributes =
 descriptor.manifest
 .contributes ||
 {};

 for (
 const command
 of contributes.commands ||
 []
 ) {
 if (
 !command?.id ||
 !command?.title
 ) {
 continue;
 }

 const id =
 `${pluginId}.${command.id}`;

 this.commands.set(
 id,
 {
 pluginId,
 id,
 localId:
 String(
 command.id
 ),
 title:
 String(
 command.title
 )
 }
 );
 }

 for (
 const view
 of contributes.views ||
 []
 ) {
 if (
 !view?.id ||
 !view?.title
 ) {
 continue;
 }

 const id =
 `${pluginId}.${view.id}`;

 this.views.set(
 id,
 {
 pluginId,
 id,
 localId:
 String(
 view.id
 ),
 title:
 String(
 view.title
 ),
 html:
 descriptor.views?.[
 view.id
 ] || ''
 }
 );
 }
 }

 async _onMessage(event) {
 const message =
 event.data;

 if (
 !message ||
 message.__orphiraPlugin !==
 true
 ) {
 return;
 }

 const pluginId =
 String(
 message.pluginId || ''
 );

 const instance =
 this.instances.get(
 pluginId
 );

 if (
 !instance ||
 event.source !==
 instance.iframe
 .contentWindow
 ) {
 return;
 }

 if (
 message.type ===
 'runtime-error'
 ) {
 console.error(
 `[Plugin:${pluginId}] Runtime error:`,
 message.error
 );

 return;
 }

 if (
 message.type ===
 'activation-error'
 ) {
 console.error(
 `[Plugin:${pluginId}] Activation error:`,
 message.error
 );

 return;
 }

 if (
 message.type ===
 'activated'
 ) {
 this.refreshUI();

 return;
 }

 if (
 message.type ===
 'callback-result'
 ) {
 const pending =
 instance
 .pendingCallbacks
 .get(
 message.callId
 );

 if (!pending) {
 return;
 }

 instance
 .pendingCallbacks
 .delete(
 message.callId
 );

 clearTimeout(
 pending.timeout
 );

 if (message.ok) {
 pending.resolve(
 message.result
 );
 } else {
 pending.reject(
 new Error(
 message.error ||
 'Plugin callback failed.'
 )
 );
 }

 return;
 }

 if (
 message.type !==
 'api-request'
 ) {
 return;
 }

 try {
 const result =
 await this._route(
 pluginId,
 String(
 message.method || ''
 ),
 message.args || {}
 );

 this._respond(
 instance,
 message.requestId,
 true,
 result
 );
 } catch (error) {
 this._respond(
 instance,
 message.requestId,
 false,
 null,
 error?.message ||
 String(error)
 );
 }
 }

 _respond(
 instance,
 requestId,
 ok,
 result,
 error = null
 ) {
 instance.iframe
 .contentWindow
 ?.postMessage(
 {
 __orphiraHost: true,
 type:
 'api-response',
 pluginId:
 instance
 .descriptor
 .manifest
 .id,
 requestId,
 ok,
 result,
 error
 },
 '*'
 );
 }

 async _route(
 pluginId,
 method,
 args
 ) {

 if (
 method.startsWith(
 'ui.layout.'
 )
 ) {
 window.OrphiraPluginApi
 .require(
 pluginId,
 'ui:layout'
 );

 if (
 !window.OrphiraPluginLayout
 ) {
 throw new Error(
 'Orphira Layout API is unavailable.'
 );
 }

 if (
 method ===
 'ui.layout.getComponents'
 ) {
 return window
 .OrphiraPluginLayout
 .getComponents();
 }

 if (
 method ===
 'ui.layout.hide'
 ) {
 return window
 .OrphiraPluginLayout
 .hide(
 pluginId,
 args.componentId
 );
 }

 if (
 method ===
 'ui.layout.show'
 ) {
 return window
 .OrphiraPluginLayout
 .show(
 pluginId,
 args.componentId
 );
 }

 if (
 method ===
 'ui.layout.move'
 ) {
 return window
 .OrphiraPluginLayout
 .move(
 pluginId,
 args.componentId,
 args.containerId
 );
 }

 if (
 method ===
 'ui.layout.setOrder'
 ) {
 return window
 .OrphiraPluginLayout
 .setOrder(
 pluginId,
 args.containerId,
 args.componentIds
 );
 }

 if (
 method ===
 'ui.layout.registerPreset'
 ) {
 return window
 .OrphiraPluginLayout
 .registerPreset(
 pluginId,
 args
 );
 }

 if (
 method ===
 'ui.layout.applyPreset'
 ) {
 return window
 .OrphiraPluginLayout
 .applyPreset(
 pluginId,
 args.presetId
 );
 }

 if (
 method ===
 'ui.layout.reset'
 ) {
 return window
 .OrphiraPluginLayout
 .reset(
 pluginId
 );
 }

 throw new Error(
 `Unknown Layout API method: ${method}`
 );
 }

 if (
 method ===
 'commands.register'
 ) {
 window.OrphiraPluginApi
 .require(
 pluginId,
 'ui:commands'
 );

 const localId =
 String(
 args.id || ''
 ).trim();

 const title =
 String(
 args.title || ''
 ).trim();

 if (
 !localId ||
 !title
 ) {
 throw new Error(
 'Command id and title are required.'
 );
 }

 const id =
 `${pluginId}.${localId}`;

 this.commands.set(
 id,
 {
 pluginId,
 id,
 localId,
 title:
 title.slice(
 0,
 100
 ),
 callbackId:
 args.callbackId ||
 null
 }
 );

 return id;
 }

 if (
 method ===
 'ui.player.addAction'
 ) {
 window.OrphiraPluginApi
 .require(
 pluginId,
 'ui:player'
 );

 return this._registerUI(
 this.playerActions,
 pluginId,
 args
 );
 }

 if (
 method ===
 'ui.sidebar.addAction'
 ) {
 window.OrphiraPluginApi
 .require(
 pluginId,
 'ui:sidebar'
 );

 return this._registerUI(
 this.sidebarActions,
 pluginId,
 args
 );
 }

 if (
 method ===
 'ui.contextMenu.addTrackAction'
 ) {
 window.OrphiraPluginApi
 .require(
 pluginId,
 'ui:context-menu'
 );

 return this._registerUI(
 this.contextActions,
 pluginId,
 args
 );
 }

 if (
 method ===
 'ui.settings.addSection'
 ) {
 window.OrphiraPluginApi
 .require(
 pluginId,
 'ui:settings'
 );

 const localId =
 String(
 args.id ||
 Date.now()
 );

 const id =
 `${pluginId}.${localId}`;

 this.settings.set(
 id,
 {
 ...args,
 id,
 pluginId
 }
 );

 this.refreshUI();

 return id;
 }

 if (
 method ===
 'ui.views.open'
 ) {
 window.OrphiraPluginApi
 .require(
 pluginId,
 'ui:views'
 );

 return this.openView(
 `${pluginId}.${args.viewId}`
 );
 }

 if (
 method ===
 'equalizer.registerVisualizerMode'
 ) {
 window.OrphiraPluginApi
 .require(
 pluginId,
 'equalizer:visualizer'
 );

 const localId =
 String(
 args.id || ''
 ).trim();

 if (!localId) {
 throw new Error(
 'Visualizer mode id is required.'
 );
 }

 const id =
 `${pluginId}.${localId}`;

 this.eqModes.set(
 id,
 {
 pluginId,
 id,
 name:
 String(
 args.name ||
 localId
 ),
 type:
 [
 'bars',
 'line',
 'dots'
 ].includes(
 args.type
 )
 ? args.type
 : 'bars',
 color:
 String(
 args.color ||
 '#ff7a45'
 ),
 secondaryColor:
 String(
 args.secondaryColor ||
 '#ffffff'
 )
 }
 );

 window.EQVisualizer
 ?.refreshPluginModes?.();

 return id;
 }

 return await window
 .OrphiraPluginApi
 .invoke(
 pluginId,
 method,
 args
 );
 }

 _registerUI(
 registry,
 pluginId,
 args
 ) {
 const localId =
 String(
 args.id || ''
 ).trim();

 const title =
 String(
 args.title || ''
 ).trim();

 if (
 !localId ||
 !title
 ) {
 throw new Error(
 'Contribution id and title are required.'
 );
 }

 const id =
 `${pluginId}.${localId}`;

 registry.set(
 id,
 {
 ...args,
 id,
 pluginId,
 title:
 title.slice(
 0,
 100
 )
 }
 );

 this.refreshUI();

 return id;
 }

 async invokeCallback(
 contribution,
 payload = null
 ) {
 if (
 !contribution
 ?.callbackId
 ) {
 return null;
 }

 const instance =
 this.instances.get(
 contribution.pluginId
 );

 if (!instance) {
 return null;
 }

 const callId =
 `host:${Date.now()}:${Math.random()
 .toString(36)
 .slice(2)}`;

 return await new Promise(
 (resolve, reject) => {
 const timeout =
 setTimeout(
 () => {
 instance
 .pendingCallbacks
 .delete(
 callId
 );

 reject(
 new Error(
 'Plugin callback timed out.'
 )
 );
 },
 10000
 );

 instance
 .pendingCallbacks
 .set(
 callId,
 {
 resolve,
 reject,
 timeout
 }
 );

 instance.iframe
 .contentWindow
 ?.postMessage(
 {
 __orphiraHost: true,
 type: 'callback',
 pluginId:
 contribution
 .pluginId,
 callbackId:
 contribution
 .callbackId,
 callId,
 payload
 },
 '*'
 );
 }
 );
 }

 emit(
 eventName,
 payload = null
 ) {
 for (
 const [pluginId, instance]
 of this.instances
 ) {
 instance.iframe
 .contentWindow
 ?.postMessage(
 {
 __orphiraHost: true,
 type: 'event',
 pluginId,
 eventName,
 payload
 },
 '*'
 );
 }
 }

 getThemes() {
 return [
 ...this.themes.values()
 ];
 }

 applyTheme(themeId) {
 const theme =
 this.themes.get(
 themeId
 );

 if (!theme) {
 return false;
 }

 document
 .querySelectorAll(
 'style[data-orphira-plugin-theme]'
 )
 .forEach(
 style =>
 style.remove()
 );

 const style =
 document.createElement(
 'style'
 );

 style.dataset
 .orphiraPluginTheme =
 theme.id;

 style.textContent =
 theme.css;

 document.head
 .appendChild(style);

 document.documentElement
 .setAttribute(
 'data-theme',
 theme.id
 );

 return true;
 }

 getEqModes() {
 return [
 ...this.eqModes.values()
 ];
 }

 getSettingsSections() {
 return [
 ...this.settings.values()
 ];
 }

 getContextActions() {
 return [
 ...this.contextActions
 .values()
 ];
 }

 getCommands() {
 return [
 ...this.commands.values()
 ];
 }

 async executeCommand(
 commandId,
 payload = null
 ) {
 const command =
 this.commands.get(
 commandId
 );

 if (!command) {
 return false;
 }

 if (
 !command.callbackId
 ) {
 return false;
 }

 await this.invokeCallback(
 command,
 payload
 );

 return true;
 }

 async openView(viewId) {
 const view =
 this.views.get(
 viewId
 );

 if (!view) {
 return false;
 }

 const container =
 document.getElementById(
 'settings-view-container'
 );

 if (!container) {
 return false;
 }

 document
 .getElementById(
 'main-header-bar'
 )
 ?.classList.add(
 'hidden'
 );

 document
 .getElementById(
 'tracklist-view'
 )
 ?.classList.add(
 'hidden'
 );

 document
 .getElementById(
 'library-grid-view'
 )
 ?.classList.add(
 'hidden'
 );

 container.classList
 .remove(
 'hidden'
 );

 container.innerHTML = '';

 const wrapper =
 document.createElement(
 'div'
 );

 wrapper.className =
 'plugin-custom-view';

 const title =
 document.createElement(
 'div'
 );

 title.className =
 'plugin-view-title';

 title.textContent =
 view.title;

 const frame =
 document.createElement(
 'iframe'
 );

 frame.className =
 'plugin-view-frame';

 frame.setAttribute(
 'sandbox',
 'allow-scripts'
 );

 frame.srcdoc =
 `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta
 http-equiv="Content-Security-Policy"
 content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';"
>
<style>
html,
body {
 margin: 0;
 padding: 16px;
 box-sizing: border-box;
 min-height: 100%;
 background: transparent;
 color: #ffffff;
 font-family: system-ui, sans-serif;
}
</style>
</head>
<body>${view.html}</body>
</html>`;

 wrapper.appendChild(
 title
 );

 wrapper.appendChild(
 frame
 );

 container.appendChild(
 wrapper
 );

 return true;
 }

 refreshUI() {
 this._renderPlayerActions();
 this._renderSidebarActions();

 if (
 this.ready &&
 window.SettingsView
 ?.currentCat ===
 'plugins'
 ) {
 window.SettingsView
 .renderCategory(
 'plugins'
 );
 }
 }

 _renderPlayerActions() {
 let host =
 document.getElementById(
 'orphira-plugin-player-actions'
 );

 if (!host) {
 host =
 document.createElement(
 'div'
 );

 host.id =
 'orphira-plugin-player-actions';

 host.className =
 'plugin-player-actions';

 const right =
 document.querySelector(
 '.right-controls'
 );

 right?.prepend(host);
 }

 host.innerHTML = '';

 for (
 const action
 of this.playerActions
 .values()
 ) {
 const button =
 document.createElement(
 'button'
 );

 button.className =
 'control-btn icon-small plugin-action-button';

 button.type =
 'button';

 button.textContent =
 action.icon ||
 '◆';

 button.title =
 action.title;

 button.addEventListener(
 'click',
 () => {
 this.invokeCallback(
 action
 ).catch(
 error =>
 console.error(
 `[Plugin:${action.pluginId}] Player action failed:`,
 error
 )
 );
 }
 );

 host.appendChild(
 button
 );
 }
 }

 _renderSidebarActions() {
 let host =
 document.getElementById(
 'orphira-plugin-sidebar-actions'
 );

 if (!host) {
 host =
 document.createElement(
 'div'
 );

 host.id =
 'orphira-plugin-sidebar-actions';

 host.className =
 'plugin-sidebar-actions';

 document
 .querySelector(
 '.sidebar-bottom-row'
 )
 ?.appendChild(host);
 }

 host.innerHTML = '';

 for (
 const action
 of this.sidebarActions
 .values()
 ) {
 const button =
 document.createElement(
 'button'
 );

 button.className =
 'sidebar-mode-btn plugin-sidebar-action';

 button.type =
 'button';

 button.textContent =
 action.icon ||
 '◆';

 button.title =
 action.title;

 button.addEventListener(
 'click',
 () => {
 this.invokeCallback(
 action
 ).catch(
 error =>
 console.error(
 `[Plugin:${action.pluginId}] Sidebar action failed:`,
 error
 )
 );
 }
 );

 host.appendChild(
 button
 );
 }
 }

 async reload() {
 for (
 const pluginId
 of [
 ...this.instances.keys()
 ]
 ) {
 await this.deactivate(
 pluginId
 );
 }

 const descriptors =
 await window.api.plugins
 .getEnabled();

 for (
 const descriptor
 of descriptors
 ) {
 try {
 await this.activate(
 descriptor
 );
 } catch (error) {
 console.error(
 `[Plugin:${descriptor.id}]`,
 error
 );
 }
 }

 this.refreshUI();
 }
}

window.PluginRuntime =
 new OrphiraPluginRuntime();