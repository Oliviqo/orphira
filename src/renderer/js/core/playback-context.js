/**
 * ORPHIRA - PLAYBACK CONTEXT MANAGER
 *
 * Управляет временными источниками воспроизведения поверх основной колоды.
 *
 * Поддерживаемая вложенность:
 * Library / Playlist / Folder
 * -> Artist
 * -> Album
 * -> Previous Context
 *
 * Каждый временный уровень хранит полный snapshot предыдущей playback-колоды.
 * Queue намеренно не входит в snapshot и остаётся глобальным приоритетным
 * слоем воспроизведения.
 */
class PlaybackContextManager {
 constructor() {
 this.stack = [];
 this.activeTemporaryType = null;
 this.activeTemporarySource = null;
 }

 isTemporaryActive() {
 return this.stack.length > 0;
 }

 isAlbumContextActive() {
 return (
 this.activeTemporaryType === 'album' &&
 this.stack.length > 0
 );
 }

 isArtistContextActive() {
 return (
 this.activeTemporaryType === 'artist' &&
 this.stack.length > 0
 );
 }

 getActiveTemporaryContext() {
 if (!this.isTemporaryActive()) {
 return null;
 }

 return {
 type: this.activeTemporaryType,
 source: this.activeTemporarySource,
 depth: this.stack.length
 };
 }

 _cloneList(list) {
 return Array.isArray(list)
 ? [...list]
 : [];
 }

 _captureCurrentContext() {
 return {
 playbackSource:
 window.state?.playbackSource ||
 'library',

 playbackList:
 this._cloneList(
 window.state?.playbackList
 ),

 playbackIndex:
 Number.isInteger(
 window.state?.playbackIndex
 )
 ? window.state.playbackIndex
 : -1,

 shuffle:
 Boolean(
 window.state?.shuffle
 ),

 playbackShuffledList:
 this._cloneList(
 window.state?.playbackShuffledList
 ),

 playbackShuffledIndex:
 Number.isInteger(
 window.state?.playbackShuffledIndex
 )
 ? window.state.playbackShuffledIndex
 : -1,

 currentTrackId:
 window.state?.currentTrackId ||
 null,

 temporaryType:
 this.activeTemporaryType,

 temporarySource:
 this.activeTemporarySource
 };
 }

 beginTemporaryContext(
 type,
 sourceId
 ) {
 if (
 !type ||
 !sourceId
 ) {
 return false;
 }

 const normalizedType =
 String(type);

 const normalizedSource =
 String(sourceId);

 if (
 this.activeTemporaryType ===
 normalizedType &&
 this.activeTemporarySource ===
 normalizedSource &&
 this.stack.length > 0
 ) {
 return false;
 }

 if (
 this.activeTemporaryType ===
 normalizedType &&
 this.stack.length > 0
 ) {
 this.activeTemporarySource =
 normalizedSource;

 return false;
 }

 const snapshot =
 this._captureCurrentContext();

 this.stack.push(
 snapshot
 );

 this.activeTemporaryType =
 normalizedType;

 this.activeTemporarySource =
 normalizedSource;

 return true;
 }

 beginAlbum(sourceId) {
 return this.beginTemporaryContext(
 'album',
 sourceId
 );
 }

 beginArtist(sourceId) {
 return this.beginTemporaryContext(
 'artist',
 sourceId
 );
 }

 _restoreSnapshot(snapshot) {
 if (
 !snapshot ||
 !window.state
 ) {
 return false;
 }

 window.state.playbackSource =
 snapshot.playbackSource;

 window.state.playbackList =
 this._cloneList(
 snapshot.playbackList
 );

 window.state.playbackIndex =
 snapshot.playbackIndex;

 window.state.shuffle =
 Boolean(
 snapshot.shuffle
 );

 window.state.playbackShuffledList =
 this._cloneList(
 snapshot.playbackShuffledList
 );

 window.state.playbackShuffledIndex =
 snapshot.playbackShuffledIndex;

 window.state.currentQueueId =
 null;

 this.activeTemporaryType =
 snapshot.temporaryType ||
 null;

 this.activeTemporarySource =
 snapshot.temporarySource ||
 null;

 if (
 window.State &&
 typeof window.State.updateModeUI ===
 'function'
 ) {
 window.State.updateModeUI();
 }

 if (
 window.Playlists &&
 typeof window.Playlists.updatePlayingHighlight ===
 'function'
 ) {
 window.Playlists.updatePlayingHighlight();
 }

 return true;
 }

 _getNextTrackFromSnapshot(
 snapshot
 ) {
 if (!snapshot) {
 return null;
 }

 if (
 snapshot.shuffle &&
 Array.isArray(
 snapshot.playbackShuffledList
 ) &&
 snapshot.playbackShuffledList.length > 0
 ) {
 const nextShuffleIndex =
 snapshot.playbackShuffledIndex + 1;

 if (
 nextShuffleIndex >= 0 &&
 nextShuffleIndex <
 snapshot.playbackShuffledList.length
 ) {
 return (
 snapshot.playbackShuffledList[
 nextShuffleIndex
 ] ||
 null
 );
 }

 if (
 window.state?.repeat === 1 &&
 snapshot.playbackShuffledList.length > 0
 ) {
 return (
 snapshot.playbackShuffledList[0] ||
 null
 );
 }

 return null;
 }

 if (
 !Array.isArray(
 snapshot.playbackList
 ) ||
 snapshot.playbackList.length === 0
 ) {
 return null;
 }

 const nextIndex =
 snapshot.playbackIndex + 1;

 if (
 nextIndex >= 0 &&
 nextIndex <
 snapshot.playbackList.length
 ) {
 return (
 snapshot.playbackList[
 nextIndex
 ] ||
 null
 );
 }

 if (
 window.state?.repeat === 1 &&
 snapshot.playbackList.length > 0
 ) {
 return (
 snapshot.playbackList[0] ||
 null
 );
 }

 return null;
 }

 async restorePreviousAndContinue() {
 if (
 this.stack.length === 0
 ) {
 return false;
 }

 const snapshot =
 this.stack.pop();

 const restored =
 this._restoreSnapshot(
 snapshot
 );

 if (!restored) {
 return false;
 }

 const nextTrack =
 this._getNextTrackFromSnapshot(
 snapshot
 );

 if (!nextTrack) {
 return true;
 }

 if (
 window.State &&
 typeof window.State.playTrack ===
 'function'
 ) {
 await window.State.playTrack(
 nextTrack,
 false
 );

 return true;
 }

 return false;
 }

 discardTemporaryContext() {
 if (
 this.stack.length === 0
 ) {
 this.activeTemporaryType =
 null;

 this.activeTemporarySource =
 null;

 return false;
 }

 const snapshot =
 this.stack.pop();

 return this._restoreSnapshot(
 snapshot
 );
 }

 discardAllTemporaryContexts() {
 let restored = false;

 while (
 this.stack.length > 0
 ) {
 restored =
 this.discardTemporaryContext() ||
 restored;
 }

 this.activeTemporaryType =
 null;

 this.activeTemporarySource =
 null;

 return restored;
 }

 reset() {
 this.stack = [];
 this.activeTemporaryType = null;
 this.activeTemporarySource = null;
 }
}

window.PlaybackContext =
 new PlaybackContextManager();