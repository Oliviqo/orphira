class OrphiraPluginApiRouter {
 constructor() {
 this.permissions = new Map();
 }

 register(
 pluginId,
 permissions
 ) {
 this.permissions.set(
 pluginId,
 new Set(
 Array.isArray(permissions)
 ? permissions
 : []
 )
 );
 }

 unregister(pluginId) {
 this.permissions.delete(
 pluginId
 );
 }

 has(
 pluginId,
 permission
 ) {
 return Boolean(
 this.permissions
 .get(pluginId)
 ?.has(permission)
 );
 }

 require(
 pluginId,
 permission
 ) {
 if (
 !this.has(
 pluginId,
 permission
 )
 ) {
 throw new Error(
 `Permission denied: ${permission}`
 );
 }
 }

 safeTrack(track) {
 if (!track) {
 return null;
 }

 return {
 id: track.id,
 title: track.title || '',
 artist: track.artist || '',
 album: track.album || '',
 duration:
 Number(
 track.duration || 0
 ),
 year:
 track.year ?? null,
 genre:
 track.genre ?? null,
 trackNumber:
 track.trackNumber ?? null,
 discNumber:
 track.discNumber ?? null
 };
 }

 currentTrack() {
 const id =
 window.state?.currentTrackId;

 if (!id) {
 return null;
 }

 const sources = [
 window.state?.library,
 window.state?.queue,
 window.state?.playbackList,
 window.state?.currentList
 ];

 for (const source of sources) {
 if (!Array.isArray(source)) {
 continue;
 }

 const found =
 source.find(
 track =>
 track?.id === id
 );

 if (found) {
 return found;
 }
 }

 return null;
 }

 safePlaylist(playlist) {
 if (!playlist) {
 return null;
 }

 return {
 id:
 String(playlist.id),
 name:
 String(
 playlist.name || ''
 ),
 pinned:
 Boolean(
 playlist.pinned
 ),
 trackIds:
 Array.isArray(
 playlist.tracks
 )
 ? [...playlist.tracks]
 : []
 };
 }

 async invoke(
 pluginId,
 method,
 args = {}
 ) {
 switch (method) {
 case 'app.getInfo':
 return {
 name:
 window.state
 ?.appIdentity
 ?.name ||
 'Orphira',
 version:
 window.state
 ?.appVersion ||
 '',
 pluginApiVersion: 2,
 language:
 window.i18n
 ?.currentLang ||
 'en'
 };

 case 'player.getCurrentTrack':
 this.require(
 pluginId,
 'player:read'
 );
 return this.safeTrack(
 this.currentTrack()
 );

 case 'player.getState':
 this.require(
 pluginId,
 'player:read'
 );
 return {
 isPlaying:
 Boolean(
 window.AudioEngine
 ?.isPlaying
 ),
 currentTime:
 Number(
 window.AudioEngine
 ?.audioElement
 ?.currentTime ||
 0
 ),
 duration:
 Number(
 window.Timeline
 ?.getDuration() ||
 0
 ),
 volume:
 Number(
 window.state
 ?.config
 ?.lastState
 ?.volume ??
 50
 ),
 playbackRate:
 Number(
 window.AudioEngine
 ?.currentPlaybackRate ||
 1
 ),
 shuffle:
 Boolean(
 window.state
 ?.shuffle
 ),
 repeat:
 Number(
 window.state
 ?.repeat ||
 0
 )
 };

 case 'player.play':
 this.require(
 pluginId,
 'player:control'
 );
 await window.AudioEngine
 ?.play();
 return true;

 case 'player.pause':
 this.require(
 pluginId,
 'player:control'
 );
 window.AudioEngine
 ?.pause();
 return true;

 case 'player.next':
 this.require(
 pluginId,
 'player:control'
 );
 window.State?.playNext();
 return true;

 case 'player.previous':
 this.require(
 pluginId,
 'player:control'
 );
 window.State?.playPrev();
 return true;

 case 'player.setVolume': {
 this.require(
 pluginId,
 'player:control'
 );

 const volume =
 Math.max(
 0,
 Math.min(
 100,
 Number(
 args.value ?? 50
 )
 )
 );

 const input =
 document.getElementById(
 'ui-volume'
 );

 if (input) {
 input.value =
 String(volume);

 input.dispatchEvent(
 new Event(
 'input',
 {
 bubbles: true
 }
 )
 );
 } else {
 window.AudioEngine
 ?.setVolume(
 volume / 100
 );
 }

 return volume;
 }

 case 'player.setPlaybackRate': {
 this.require(
 pluginId,
 'player:control'
 );

 const rate =
 Math.max(
 0.2,
 Math.min(
 2,
 Number(
 args.value || 1
 )
 )
 );

 window.AudioEngine
 ?.setPlaybackRate(rate);

 if (
 window.state
 ?.config
 ?.lastState
 ) {
 window.state.config
 .lastState
 .playbackRate =
 rate;

 window.api.db
 .saveConfig(
 window.state.config
 );
 }

 return rate;
 }

 case 'timeline.get':
 this.require(
 pluginId,
 'timeline:read'
 );
 return {
 currentTime:
 Number(
 window.AudioEngine
 ?.audioElement
 ?.currentTime ||
 0
 ),
 duration:
 Number(
 window.Timeline
 ?.getDuration() ||
 0
 ),
 seeking:
 Boolean(
 window.Timeline
 ?.isSeeking
 )
 };

 case 'timeline.seek': {
 this.require(
 pluginId,
 'timeline:control'
 );

 const audio =
 window.AudioEngine
 ?.audioElement;

 const duration =
 Number(
 window.Timeline
 ?.getDuration() ||
 0
 );

 if (!audio) {
 return false;
 }

 const target =
 Math.max(
 0,
 Math.min(
 duration ||
 Number(args.seconds || 0),
 Number(
 args.seconds || 0
 )
 )
 );

 audio.currentTime =
 target;

 window.Timeline
 ?.resetTime(target);

 window.Timeline
 ?.updateUI(
 target,
 duration
 );

 return true;
 }

 case 'queue.get':
 this.require(
 pluginId,
 'queue:read'
 );
 return (
 window.state
 ?.queue || []
 ).map(
 track =>
 this.safeTrack(track)
 );

 case 'queue.addNext':
 this.require(
 pluginId,
 'queue:write'
 );
 this._queueTracks(
 args.trackIds,
 true
 );
 return true;

 case 'queue.addEnd':
 this.require(
 pluginId,
 'queue:write'
 );
 this._queueTracks(
 args.trackIds,
 false
 );
 return true;

 case 'queue.clear':
 this.require(
 pluginId,
 'queue:write'
 );
 window.QueuePanel
 ?.clearQueue(false);
 return true;

 case 'library.getTracks':
 this.require(
 pluginId,
 'library:read'
 );
 return (
 window.state
 ?.library || []
 ).map(
 track =>
 this.safeTrack(track)
 );

 case 'library.getTrack':
 this.require(
 pluginId,
 'library:read'
 );
 return this.safeTrack(
 window.state
 ?.library
 ?.find(
 track =>
 track.id ===
 args.trackId
 )
 );

 case 'playlists.get':
 this.require(
 pluginId,
 'playlists:read'
 );
 return (
 window.state
 ?.playlists || []
 ).map(
 playlist =>
 this.safePlaylist(
 playlist
 )
 );

 case 'playlists.create':
 this.require(
 pluginId,
 'playlists:write'
 );
 return await this
 ._createPlaylist(args);

 case 'playlists.remove':
 this.require(
 pluginId,
 'playlists:write'
 );
 return await this
 ._removePlaylist(args);

 case 'playlists.addTracks':
 this.require(
 pluginId,
 'playlists:write'
 );
 return await this
 ._addPlaylistTracks(
 args
 );

 case 'equalizer.get':
 this.require(
 pluginId,
 'equalizer:read'
 );
 return JSON.parse(
 JSON.stringify(
 window.state
 ?.config
 ?.eq || {}
 )
 );

 case 'equalizer.setBand':
 this.require(
 pluginId,
 'equalizer:control'
 );
 return this._setEqBand(
 args.index,
 args.gain
 );

 case 'equalizer.setPreamp':
 this.require(
 pluginId,
 'equalizer:control'
 );
 return this._setEqPreamp(
 args.value
 );

 case 'equalizer.setQ':
 this.require(
 pluginId,
 'equalizer:control'
 );
 return this._setEqQ(
 args.value
 );

 case 'equalizer.setBypass':
 this.require(
 pluginId,
 'equalizer:control'
 );
 return this._setEqBypass(
 args.value
 );

 case 'equalizer.applyPreset':
 this.require(
 pluginId,
 'equalizer:control'
 );
 return this._applyEqPreset(
 args.gains
 );

 case 'equalizer.getSpectrum':
 this.require(
 pluginId,
 'equalizer:visualizer'
 );
 return Array.from(
 window.AudioEngine
 ?.getVisualizerData?.() ||
 []
 );

 case 'lyrics.getCurrent':
 this.require(
 pluginId,
 'lyrics:read'
 );
 return (
 window.state
 ?.parsedLyrics || []
 ).map(line => ({
 time:
 Number(line.time || 0),
 text:
 String(
 line.text || ''
 )
 }));

 case 'storage.get':
 this.require(
 pluginId,
 'storage'
 );
 return await window.api
 .plugins
 .dataGet(
 pluginId,
 String(args.key || '')
 );

 case 'storage.set':
 this.require(
 pluginId,
 'storage'
 );
 return await window.api
 .plugins
 .dataSet(
 pluginId,
 String(args.key || ''),
 args.value
 );

 case 'storage.delete':
 this.require(
 pluginId,
 'storage'
 );
 return await window.api
 .plugins
 .dataDelete(
 pluginId,
 String(args.key || '')
 );

 case 'network.fetch':
 this.require(
 pluginId,
 'network'
 );
 return await window.api
 .plugins
 .networkFetch(
 pluginId,
 {
 url:
 String(
 args.url || ''
 ),
 method:
 String(
 args.method ||
 'GET'
 ),
 headers:
 args.headers &&
 typeof args.headers ===
 'object'
 ? args.headers
 : {},
 body:
 args.body ??
 null
 }
 );

 case 'notifications.show':
 this.require(
 pluginId,
 'ui:notifications'
 );
 return this
 ._notification(args);

 default:
 throw new Error(
 `Unknown Plugin API method: ${method}`
 );
 }
 }

 _queueTracks(
 trackIds,
 next
 ) {
 const ids =
 Array.isArray(trackIds)
 ? trackIds
 : [];

 const tracks =
 ids.map(
 id =>
 window.state
 ?.library
 ?.find(
 track =>
 track.id === id
 )
 )
 .filter(Boolean);

 if (next) {
 window.State
 ?.addToQueueNext(
 tracks
 );
 } else {
 window.State
 ?.addToQueueEnd(
 tracks
 );
 }
 }

 async _createPlaylist(args) {
 const name =
 String(
 args.name || ''
 )
 .trim()
 .slice(0, 100);

 if (!name) {
 throw new Error(
 'Playlist name is required.'
 );
 }

 const playlist = {
 id:
 `plugin_${Date.now()}_${Math.random()
 .toString(36)
 .slice(2, 8)}`,
 name,
 tracks: [],
 pinned: false
 };

 window.state.playlists
 .push(playlist);

 await window.api.db
 .savePlaylists(
 window.state.playlists
 );

 window.Playlists
 ?.render();

 window.PluginRuntime
 ?.emit(
 'playlists.changed',
 null
 );

 return this.safePlaylist(
 playlist
 );
 }

 async _removePlaylist(args) {
 const id =
 String(
 args.playlistId || ''
 );

 const index =
 window.state.playlists
 .findIndex(
 playlist =>
 String(
 playlist.id
 ) === id
 );

 if (index === -1) {
 return false;
 }

 window.state.playlists
 .splice(index, 1);

 await window.api.db
 .savePlaylists(
 window.state.playlists
 );

 window.Playlists
 ?.render();

 window.PluginRuntime
 ?.emit(
 'playlists.changed',
 null
 );

 return true;
 }

 async _addPlaylistTracks(
 args
 ) {
 const playlist =
 window.state.playlists
 .find(
 item =>
 String(item.id) ===
 String(
 args.playlistId ||
 ''
 )
 );

 if (!playlist) {
 throw new Error(
 'Playlist not found.'
 );
 }

 const validIds =
 new Set(
 window.state.library
 .map(track => track.id)
 );

 const ids =
 Array.isArray(
 args.trackIds
 )
 ? args.trackIds
 : [];

 for (const id of ids) {
 if (
 validIds.has(id) &&
 !playlist.tracks
 .includes(id)
 ) {
 playlist.tracks
 .push(id);
 }
 }

 await window.api.db
 .savePlaylists(
 window.state.playlists
 );

 window.Playlists
 ?.render();

 window.PluginRuntime
 ?.emit(
 'playlists.changed',
 null
 );

 return this.safePlaylist(
 playlist
 );
 }

 _setEqBand(
 indexValue,
 gainValue
 ) {
 const index =
 Number(indexValue);

 const gain =
 Math.max(
 -12,
 Math.min(
 12,
 Number(gainValue || 0)
 )
 );

 if (
 !Number.isInteger(index) ||
 index < 0 ||
 index > 9
 ) {
 throw new Error(
 'EQ band index must be 0-9.'
 );
 }

 window.Equalizer
 ?.updateBand(
 index,
 gain
 );

 window.PluginRuntime
 ?.emit(
 'equalizer.changed',
 {
 type: 'band',
 index,
 value: gain
 }
 );

 return gain;
 }

 _setEqPreamp(value) {
 const gain =
 Math.max(
 -12,
 Math.min(
 12,
 Number(value || 0)
 )
 );

 window.state.config
 .eq.preamp = gain;

 window.Equalizer
 ?.renderSliders();

 window.Equalizer
 ?.applyToEngine();

 window.Equalizer
 ?.saveConfig();

 window.PluginRuntime
 ?.emit(
 'equalizer.changed',
 {
 type: 'preamp',
 value: gain
 }
 );

 return gain;
 }

 _setEqQ(value) {
 const q =
 Math.max(
 0.1,
 Math.min(
 10,
 Number(value || 1.4)
 )
 );

 window.state.config.eq
 .qFactor = q;

 window.AudioEngine
 ?.filters
 ?.forEach(
 filter => {
 if (filter.Q) {
 filter.Q.value = q;
 }
 }
 );

 window.Equalizer
 ?.saveConfig();

 window.PluginRuntime
 ?.emit(
 'equalizer.changed',
 {
 type: 'q',
 value: q
 }
 );

 return q;
 }

 _setEqBypass(value) {
 const bypass =
 Boolean(value);

 window.state.config.eq
 .bypass = bypass;

 window.Equalizer
 ?.applyToEngine();

 window.Equalizer
 ?.saveConfig();

 const button =
 document.getElementById(
 'btn-eq-bypass'
 );

 if (
 button &&
 window.Equalizer
 ?._updateBypassUI
 ) {
 window.Equalizer
 ._updateBypassUI(
 button
 );
 }

 window.PluginRuntime
 ?.emit(
 'equalizer.changed',
 {
 type: 'bypass',
 value: bypass
 }
 );

 return bypass;
 }

 _applyEqPreset(gainsValue) {
 if (
 !Array.isArray(
 gainsValue
 ) ||
 gainsValue.length !== 10
 ) {
 throw new Error(
 'EQ preset requires exactly 10 gains.'
 );
 }

 const gains =
 gainsValue.map(
 value =>
 Math.max(
 -12,
 Math.min(
 12,
 Number(value || 0)
 )
 )
 );

 window.state.config.eq
 .gains =
 [...gains];

 window.Equalizer
 ?.renderSliders();

 window.Equalizer
 ?.renderPresetsDropdown();

 window.Equalizer
 ?.applyToEngine();

 window.Equalizer
 ?.saveConfig();

 window.PluginRuntime
 ?.emit(
 'equalizer.changed',
 {
 type: 'preset',
 gains
 }
 );

 return gains;
 }

 _notification(args) {
 const message =
 String(
 args.message || ''
 )
 .slice(0, 500);

 const type =
 String(
 args.type || 'info'
 );

 if (!window.Toast) {
 return false;
 }

 if (type === 'success') {
 window.Toast.success(
 message
 );
 } else if (
 type === 'error'
 ) {
 window.Toast.error(
 message
 );
 } else if (
 type === 'warning'
 ) {
 window.Toast.warn(
 message
 );
 } else {
 window.Toast.info(
 message
 );
 }

 return true;
 }
}

window.OrphiraPluginApi =
 new OrphiraPluginApiRouter();