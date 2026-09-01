class OrphiraPluginLayoutManager {
 constructor() {
 this.initialized = false;
 this.components = new Map();
 this.containers = new Map();
 this.pluginState = new Map();
 this.presets = new Map();
 this.baseSnapshots = new Map();

 this.componentDefinitions = [
 {
 id: 'player.cover',
 selector: '#ui-cover',
 container: 'player.info',
 movableTo: [
 'player.info'
 ]
 },
 {
 id: 'player.metadata',
 selector: '.control-panel .track-meta',
 container: 'player.info',
 movableTo: [
 'player.info'
 ]
 },
 {
 id: 'player.transport',
 selector: '.control-panel .player-buttons',
 container: 'player.center',
 movableTo: [
 'player.center'
 ]
 },
 {
 id: 'player.timeline',
 selector: '.control-panel .progress-container',
 container: 'player.center',
 movableTo: [
 'player.center'
 ]
 },
 {
 id: 'player.equalizer',
 selector: '#btn-eq-toggle',
 container: 'player.actions',
 movableTo: [
 'player.actions'
 ]
 },
 {
 id: 'player.queue',
 selector: '#btn-queue-toggle',
 container: 'player.actions',
 movableTo: [
 'player.actions'
 ]
 },
 {
 id: 'player.speed',
 selector: '#speed-control-wrapper',
 container: 'player.actions',
 movableTo: [
 'player.actions'
 ]
 },
 {
 id: 'player.volume',
 selector: '.control-panel .volume-control',
 container: 'player.actions',
 movableTo: [
 'player.actions'
 ]
 },
 {
 id: 'player.visualizer',
 selector: '#visualizer-canvas',
 container: 'player.root',
 movableTo: [
 'player.root'
 ]
 },
 {
 id: 'player.pluginActions',
 selector: '#orphira-plugin-player-actions',
 container: 'player.actions',
 movableTo: [
 'player.actions'
 ],
 dynamic: true
 },
 {
 id: 'fullscreen.cover',
 selector: '#fs-cover',
 container: 'fullscreen.player',
 movableTo: [
 'fullscreen.player'
 ]
 },
 {
 id: 'fullscreen.metadata',
 selector: '#fullscreen-overlay .fullscreen-meta',
 container: 'fullscreen.player',
 movableTo: [
 'fullscreen.player'
 ]
 },
 {
 id: 'fullscreen.timeline',
 selector: '#fullscreen-overlay .fullscreen-progress-wrapper',
 container: 'fullscreen.player',
 movableTo: [
 'fullscreen.player'
 ]
 },
 {
 id: 'fullscreen.transport',
 selector: '#fullscreen-overlay .fullscreen-buttons',
 container: 'fullscreen.player',
 movableTo: [
 'fullscreen.player'
 ]
 },
 {
 id: 'fullscreen.equalizer',
 selector: '#fs-btn-eq',
 container: 'fullscreen.subControls',
 movableTo: [
 'fullscreen.subControls'
 ]
 },
 {
 id: 'fullscreen.lyricsToggle',
 selector: '#fs-btn-lyrics-toggle',
 container: 'fullscreen.subControls',
 movableTo: [
 'fullscreen.subControls'
 ]
 },
 {
 id: 'fullscreen.volume',
 selector: '#fullscreen-overlay .fullscreen-volume-wrapper',
 container: 'fullscreen.subControls',
 movableTo: [
 'fullscreen.subControls'
 ]
 },
 {
 id: 'fullscreen.lyrics',
 selector: '#fullscreen-overlay .fullscreen-lyrics-panel',
 container: 'fullscreen.root',
 movableTo: [
 'fullscreen.root'
 ]
 },
 {
 id: 'fullscreen.pluginActions',
 selector: '#orphira-plugin-fullscreen-actions',
 container: 'fullscreen.subControls',
 movableTo: [
 'fullscreen.subControls'
 ],
 dynamic: true
 }
 ];

 this.containerDefinitions = [
 {
 id: 'player.root',
 selector: '.control-panel'
 },
 {
 id: 'player.info',
 selector: '.control-panel .track-info'
 },
 {
 id: 'player.center',
 selector: '.control-panel .player-controls-wrapper'
 },
 {
 id: 'player.actions',
 selector: '.control-panel .right-controls'
 },
 {
 id: 'fullscreen.root',
 selector: '#fullscreen-overlay'
 },
 {
 id: 'fullscreen.player',
 selector: '#fullscreen-overlay .fullscreen-player-box'
 },
 {
 id: 'fullscreen.subControls',
 selector: '#fullscreen-overlay .fullscreen-sub-controls'
 }
 ];
 }

 init() {
 if (this.initialized) {
 this.refresh();
 return;
 }

 this.initialized = true;
 this.refresh();
 }

 refresh() {
 for (
 const definition
 of this.containerDefinitions
 ) {
 const element =
 document.querySelector(
 definition.selector
 );

 if (element) {
 this.containers.set(
 definition.id,
 {
 ...definition,
 element
 }
 );
 }
 }

 this._ensureDynamicHosts();

 for (
 const definition
 of this.componentDefinitions
 ) {
 const element =
 document.querySelector(
 definition.selector
 );

 if (!element) {
 if (!definition.dynamic) {
 console.warn(
 `[PluginLayout] Component is unavailable: ${definition.id}`
 );
 }
 continue;
 }

 const existing =
 this.components.get(
 definition.id
 );

 if (existing?.element === element) {
 continue;
 }

 this.components.set(
 definition.id,
 {
 ...definition,
 element
 }
 );

 if (
 !this.baseSnapshots.has(
 definition.id
 )
 ) {
 this.baseSnapshots.set(
 definition.id,
 this._createSnapshot(
 element
 )
 );
 }
 }

 this._applyEffectiveState();
 }

 _ensureDynamicHosts() {
 let playerHost =
 document.getElementById(
 'orphira-plugin-player-actions'
 );

 if (!playerHost) {
 playerHost =
 document.createElement(
 'div'
 );
 playerHost.id =
 'orphira-plugin-player-actions';
 playerHost.className =
 'plugin-player-actions';

 document
 .querySelector(
 '.control-panel .right-controls'
 )
 ?.prepend(
 playerHost
 );
 }

 let fullscreenHost =
 document.getElementById(
 'orphira-plugin-fullscreen-actions'
 );

 if (!fullscreenHost) {
 fullscreenHost =
 document.createElement(
 'div'
 );
 fullscreenHost.id =
 'orphira-plugin-fullscreen-actions';
 fullscreenHost.className =
 'plugin-fullscreen-actions';

 document
 .querySelector(
 '#fullscreen-overlay .fullscreen-sub-controls'
 )
 ?.appendChild(
 fullscreenHost
 );
 }
 }

 _createSnapshot(element) {
 return {
 parent:
 element.parentNode,
 nextSibling:
 element.nextSibling,
 display:
 element.style.display,
 order:
 element.style.order
 };
 }

 _getPluginState(pluginId) {
 if (
 !this.pluginState.has(
 pluginId
 )
 ) {
 this.pluginState.set(
 pluginId,
 {
 visibility:
 new Map(),
 moves:
 new Map(),
 orders:
 new Map(),
 activePreset:
 null
 }
 );
 }

 return this.pluginState.get(
 pluginId
 );
 }

 _assertPluginId(pluginId) {
 const id =
 String(pluginId || '')
 .trim();

 if (!id) {
 throw new Error(
 'Plugin id is required.'
 );
 }

 return id;
 }

 _requireComponent(componentId) {
 this.refreshRegistryOnly();

 const id =
 String(componentId || '')
 .trim();
 const component =
 this.components.get(id);

 if (!component) {
 throw new Error(
 `Unknown layout component: ${id}`
 );
 }

 return component;
 }

 _requireContainer(containerId) {
 this.refreshRegistryOnly();

 const id =
 String(containerId || '')
 .trim();
 const container =
 this.containers.get(id);

 if (!container) {
 throw new Error(
 `Unknown layout container: ${id}`
 );
 }

 return container;
 }

 refreshRegistryOnly() {
 for (
 const definition
 of this.containerDefinitions
 ) {
 const element =
 document.querySelector(
 definition.selector
 );

 if (element) {
 this.containers.set(
 definition.id,
 {
 ...definition,
 element
 }
 );
 }
 }

 this._ensureDynamicHosts();

 for (
 const definition
 of this.componentDefinitions
 ) {
 const element =
 document.querySelector(
 definition.selector
 );

 if (!element) {
 continue;
 }

 this.components.set(
 definition.id,
 {
 ...definition,
 element
 }
 );

 if (
 !this.baseSnapshots.has(
 definition.id
 )
 ) {
 this.baseSnapshots.set(
 definition.id,
 this._createSnapshot(
 element
 )
 );
 }
 }
 }

 getComponents() {
 this.refreshRegistryOnly();

 return [
 ...this.componentDefinitions
 ].map(
 definition => {
 const component =
 this.components.get(
 definition.id
 );

 return {
 id:
 definition.id,
 available:
 Boolean(component?.element),
 container:
 definition.container,
 movableTo:
 [
 ...definition.movableTo
 ]
 };
 }
 );
 }

 hide(pluginId, componentId) {
 const owner =
 this._assertPluginId(
 pluginId
 );
 const component =
 this._requireComponent(
 componentId
 );
 const state =
 this._getPluginState(
 owner
 );

 state.visibility.set(
 component.id,
 false
 );

 this._applyEffectiveState();

 return true;
 }

 show(pluginId, componentId) {
 const owner =
 this._assertPluginId(
 pluginId
 );
 const component =
 this._requireComponent(
 componentId
 );
 const state =
 this._getPluginState(
 owner
 );

 state.visibility.set(
 component.id,
 true
 );

 this._applyEffectiveState();

 return true;
 }

 move(
 pluginId,
 componentId,
 containerId
 ) {
 const owner =
 this._assertPluginId(
 pluginId
 );
 const component =
 this._requireComponent(
 componentId
 );
 const target =
 this._requireContainer(
 containerId
 );

 if (
 !component.movableTo.includes(
 target.id
 )
 ) {
 throw new Error(
 `Component ${component.id} cannot be moved to ${target.id}.`
 );
 }

 const state =
 this._getPluginState(
 owner
 );

 state.moves.set(
 component.id,
 target.id
 );

 this._applyEffectiveState();

 return true;
 }

 setOrder(
 pluginId,
 containerId,
 componentIds
 ) {
 const owner =
 this._assertPluginId(
 pluginId
 );
 const container =
 this._requireContainer(
 containerId
 );

 if (
 !Array.isArray(
 componentIds
 )
 ) {
 throw new Error(
 'Layout order must be an array.'
 );
 }

 const uniqueIds = [
 ...new Set(
 componentIds.map(
 value =>
 String(value || '')
 .trim()
 )
 )
 ].filter(Boolean);

 for (const componentId of uniqueIds) {
 const component =
 this._requireComponent(
 componentId
 );

 if (
 !component.movableTo.includes(
 container.id
 )
 ) {
 throw new Error(
 `Component ${component.id} cannot be ordered inside ${container.id}.`
 );
 }
 }

 const state =
 this._getPluginState(
 owner
 );

 state.orders.set(
 container.id,
 uniqueIds
 );

 this._applyEffectiveState();

 return true;
 }

 registerPreset(
 pluginId,
 definition
 ) {
 const owner =
 this._assertPluginId(
 pluginId
 );
 const source =
 definition &&
 typeof definition ===
 'object'
 ? definition
 : {};

 const localId =
 String(
 source.id || ''
 )
 .trim();

 const name =
 String(
 source.name || localId
 )
 .trim();

 if (!localId) {
 throw new Error(
 'Layout preset id is required.'
 );
 }

 if (
 !/^[a-zA-Z0-9._-]{1,80}$/.test(
 localId
 )
 ) {
 throw new Error(
 'Invalid layout preset id.'
 );
 }

 const presetId =
 `${owner}.${localId}`;

 const hidden =
 Array.isArray(
 source.hidden
 )
 ? [
 ...new Set(
 source.hidden.map(
 value =>
 String(value || '')
 .trim()
 )
 )
 ].filter(Boolean)
 : [];

 const shown =
 Array.isArray(
 source.shown
 )
 ? [
 ...new Set(
 source.shown.map(
 value =>
 String(value || '')
 .trim()
 )
 )
 ].filter(Boolean)
 : [];

 const moves =
 source.moves &&
 typeof source.moves ===
 'object' &&
 !Array.isArray(
 source.moves
 )
 ? {
 ...source.moves
 }
 : {};

 const order =
 source.order &&
 typeof source.order ===
 'object' &&
 !Array.isArray(
 source.order
 )
 ? JSON.parse(
 JSON.stringify(
 source.order
 )
 )
 : {};

 for (const componentId of hidden) {
 this._requireComponent(
 componentId
 );
 }

 for (const componentId of shown) {
 this._requireComponent(
 componentId
 );
 }

 for (
 const [
 componentId,
 containerId
 ]
 of Object.entries(moves)
 ) {
 const component =
 this._requireComponent(
 componentId
 );
 const container =
 this._requireContainer(
 containerId
 );

 if (
 !component.movableTo.includes(
 container.id
 )
 ) {
 throw new Error(
 `Component ${component.id} cannot be moved to ${container.id}.`
 );
 }
 }

 for (
 const [
 containerId,
 componentIds
 ]
 of Object.entries(order)
 ) {
 const container =
 this._requireContainer(
 containerId
 );

 if (
 !Array.isArray(
 componentIds
 )
 ) {
 throw new Error(
 `Order for ${container.id} must be an array.`
 );
 }

 for (
 const componentId
 of componentIds
 ) {
 const component =
 this._requireComponent(
 componentId
 );

 if (
 !component.movableTo.includes(
 container.id
 )
 ) {
 throw new Error(
 `Component ${component.id} cannot be ordered inside ${container.id}.`
 );
 }
 }
 }

 this.presets.set(
 presetId,
 {
 pluginId:
 owner,
 id:
 presetId,
 localId,
 name:
 name.slice(0, 100),
 hidden,
 shown,
 moves,
 order
 }
 );

 return presetId;
 }

 applyPreset(
 pluginId,
 presetId
 ) {
 const owner =
 this._assertPluginId(
 pluginId
 );
 const requested =
 String(
 presetId || ''
 )
 .trim();

 const fullId =
 requested.startsWith(
 `${owner}.`
 )
 ? requested
 : `${owner}.${requested}`;

 const preset =
 this.presets.get(
 fullId
 );

 if (
 !preset ||
 preset.pluginId !==
 owner
 ) {
 throw new Error(
 `Layout preset not found: ${requested}`
 );
 }

 const state =
 this._getPluginState(
 owner
 );

 state.visibility.clear();
 state.moves.clear();
 state.orders.clear();

 for (
 const componentId
 of preset.hidden
 ) {
 state.visibility.set(
 componentId,
 false
 );
 }

 for (
 const componentId
 of preset.shown
 ) {
 state.visibility.set(
 componentId,
 true
 );
 }

 for (
 const [
 componentId,
 containerId
 ]
 of Object.entries(
 preset.moves
 )
 ) {
 state.moves.set(
 componentId,
 containerId
 );
 }

 for (
 const [
 containerId,
 componentIds
 ]
 of Object.entries(
 preset.order
 )
 ) {
 state.orders.set(
 containerId,
 [
 ...componentIds
 ]
 );
 }

 state.activePreset =
 preset.id;

 this._applyEffectiveState();

 return true;
 }

 reset(pluginId) {
 const owner =
 this._assertPluginId(
 pluginId
 );

 this.pluginState.delete(
 owner
 );

 this._applyEffectiveState();

 return true;
 }

 unregisterPlugin(pluginId) {
 const owner =
 String(pluginId || '')
 .trim();

 if (!owner) {
 return;
 }

 this.pluginState.delete(
 owner
 );

 for (
 const [
 presetId,
 preset
 ]
 of [
 ...this.presets.entries()
 ]
 ) {
 if (
 preset.pluginId ===
 owner
 ) {
 this.presets.delete(
 presetId
 );
 }
 }

 this._applyEffectiveState();
 }

 _restoreBaseLayout() {
 for (
 const [
 componentId,
 component
 ]
 of this.components
 ) {
 const snapshot =
 this.baseSnapshots.get(
 componentId
 );

 if (
 !snapshot ||
 !component.element
 ) {
 continue;
 }

 const element =
 component.element;

 if (
 snapshot.parent &&
 snapshot.parent.isConnected
 ) {
 if (
 snapshot.nextSibling &&
 snapshot.nextSibling.parentNode ===
 snapshot.parent
 ) {
 snapshot.parent.insertBefore(
 element,
 snapshot.nextSibling
 );
 } else {
 snapshot.parent.appendChild(
 element
 );
 }
 }

 element.style.display =
 snapshot.display;

 element.style.order =
 snapshot.order;

 element.classList.remove(
 'orphira-layout-hidden'
 );
 }
 }

 _applyEffectiveState() {
 this.refreshRegistryOnly();
 this._restoreBaseLayout();

 const states = [
 ...this.pluginState.entries()
 ];

 for (
 const [
 pluginId,
 state
 ]
 of states
 ) {
 for (
 const [
 componentId,
 containerId
 ]
 of state.moves
 ) {
 const component =
 this.components.get(
 componentId
 );
 const container =
 this.containers.get(
 containerId
 );

 if (
 !component?.element ||
 !container?.element ||
 !component.movableTo.includes(
 containerId
 )
 ) {
 continue;
 }

 container.element.appendChild(
 component.element
 );
 }

 for (
 const [
 containerId,
 componentIds
 ]
 of state.orders
 ) {
 const container =
 this.containers.get(
 containerId
 );

 if (!container?.element) {
 continue;
 }

 componentIds.forEach(
 (
 componentId,
 index
 ) => {
 const component =
 this.components.get(
 componentId
 );

 if (
 !component?.element ||
 component.element.parentNode !==
 container.element
 ) {
 return;
 }

 component.element.style.order =
 String(index);
 }
 );
 }
 }

 for (
 const [
 componentId,
 component
 ]
 of this.components
 ) {
 let hidden = false;
 let explicitShow = false;

 for (
 const state
 of this.pluginState.values()
 ) {
 if (
 !state.visibility.has(
 componentId
 )
 ) {
 continue;
 }

 const visible =
 state.visibility.get(
 componentId
 );

 if (visible === false) {
 hidden = true;
 }

 if (visible === true) {
 explicitShow = true;
 }
 }

 const shouldHide =
 hidden && !explicitShow;

 component.element
 .classList.toggle(
 'orphira-layout-hidden',
 shouldHide
 );
 }
 }
}

window.OrphiraPluginLayout =
 new OrphiraPluginLayoutManager();