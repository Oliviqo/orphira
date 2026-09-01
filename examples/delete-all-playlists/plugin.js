module.exports = {
 async activate(api) {
 const playlists =
 await api.playlists.get();

 let deleted = 0;

 for (
 const playlist
 of playlists
 ) {
 const removed =
 await api.playlists.remove(
 playlist.id
 );

 if (removed) {
 deleted++;
 }
 }

 await api.notifications.show(
 `Deleted ${deleted} playlists`,
 'success'
 );
 },

 async deactivate() {
 }
};