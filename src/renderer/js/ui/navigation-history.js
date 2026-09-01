/**
 * COSMIC PLAYER - OVERLAY NAVIGATION HISTORY
 * Централизованная история вложенных экранов Album / Artist / Folder.
 * Queue является независимой панелью и намеренно не входит в Back Stack.
 */
class NavigationHistoryManager {
 constructor() {
 this.stack = [];
 this.restoring = false;
 }

 captureSearchState() {
 const search = window.Search;
 const input = search?.inputEl || document.getElementById('search-input');

 return {
  query: input?.value || '',
  placeholder:
   input?.getAttribute('placeholder') ||
   window.i18n?.t('search') ||
   'Search track, artist, album...'
 };
 }

 push(entry) {
 if (!entry || !entry.type) return;

 this.stack.push({
  ...entry,
  searchState: entry.searchState || this.captureSearchState()
 });
 }

 replaceTop(entry) {
 if (!entry || !entry.type) return;

 const normalized = {
  ...entry,
  searchState: entry.searchState || this.captureSearchState()
 };

 if (this.stack.length === 0) {
  this.stack.push(normalized);
 } else {
  this.stack[this.stack.length - 1] = normalized;
 }
 }

 pop() {
 return this.stack.pop() || null;
 }

 peek() {
 return this.stack.length > 0
  ? this.stack[this.stack.length - 1]
  : null;
 }

 clear() {
 this.stack = [];
 }

 canGoBack() {
 return this.stack.length > 0;
 }

 restoreSearchState(searchState, reapply = true) {
 const search = window.Search;
 const input = search?.inputEl || document.getElementById('search-input');
 if (!input) return;

 const query = searchState?.query || '';
 const placeholder =
  searchState?.placeholder ||
  window.i18n?.t('search') ||
  'Search track, artist, album...';

 input.placeholder = placeholder;
 input.value = query;

 if (search?._toggleClearButton) {
  search._toggleClearButton(query.length > 0);
 }

 if (search?.hideHistoryDropdown) {
  search.hideHistoryDropdown();
 }

 if (reapply && search?.executeSearch) {
  search.executeSearch(query);
 }
 }

 async back() {
 if (this.restoring) {
 return false;
 }

 const destination =
 this.pop();

 if (!destination) {
 return false;
 }

 this.restoring = true;

 try {
 if (
 window.AlbumCoverViewer?.isOpen
 ) {
 window.AlbumCoverViewer.close();
 }

 if (
 window.AlbumView?.isOpen
 ) {
 window.AlbumView.close({
 restoreSearch: false,
 fromNavigation: true
 });
 }

 if (
 destination.type ===
 'artist'
 ) {
 if (
 window.ArtistView
 ?.restoreNavigationState
 ) {
 await window.ArtistView
 .restoreNavigationState(
 destination
 );
 }

 this.restoreSearchState(
 destination.searchState,
 false
 );

 return true;
 }

 if (
 destination.type ===
 'library'
 ) {
 if (
 window.ArtistView?.isOpen
 ) {
 window.ArtistView.close({
 restoreSearch: false,
 fromNavigation: true
 });
 }

 if (
 destination.libraryView &&
 window.LibraryViews
 ) {
 window.LibraryViews.switchView(
 destination.libraryView
 );
 }

 this.restoreSearchState(
 destination.searchState,
 true
 );

 const grid =
 document.getElementById(
 'library-grid-view'
 );

 if (
 grid &&
 Number.isFinite(
 Number(
 destination.libraryScrollTop
 )
 )
 ) {
 requestAnimationFrame(
 () => {
 grid.scrollTop =
 Number(
 destination.libraryScrollTop
 ) || 0;
 }
 );
 }

 return true;
 }

 if (
 destination.type ===
 'folder' &&
 window.FolderView
 ?.restoreNavigationState
 ) {
 await window.FolderView
 .restoreNavigationState(
 destination
 );

 this.restoreSearchState(
 destination.searchState,
 true
 );

 return true;
 }

 this.restoreSearchState(
 destination.searchState,
 true
 );

 return true;
 } finally {
 this.restoring = false;
 }
 }
}

window.NavigationHistory = new NavigationHistoryManager();