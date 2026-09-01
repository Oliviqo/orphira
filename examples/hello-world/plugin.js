module.exports = {
 async activate(api) {
 let count =
 await api.storage.get(
 'count'
 ) || 0;

 await api.notifications.show(
 'Hello World API v2 started',
 'success'
 );

 await api.ui.player.addAction({
 id: 'hello',
 title: 'Hello World',
 icon: '◆',

 async onClick() {
 const track =
 await api.player.getCurrentTrack();

 await api.notifications.show(
 track
 ? track.title
 : 'Nothing playing',
 'info'
 );
 }
 });

 await api.ui.settings.addSection({
 id: 'general',
 title: 'Hello World',
 controls: [
 {
 id: 'enabled',
 type: 'toggle',
 label: 'Example toggle',
 description:
 'A setting owned by this plugin.',
 default: true,

 async onChange(event) {
 await api.notifications.show(
 `Setting: ${event.value}`,
 'info'
 );
 }
 }
 ]
 });

 await api.equalizer
 .registerVisualizerMode({
 id: 'hello-bars',
 name: 'Hello Bars',
 type: 'bars',
 color: '#ff7a45',
 secondaryColor: '#6366f1'
 });

 api.events.on(
 'player.trackChanged',
 async track => {
 count += 1;

 await api.storage.set(
 'count',
 count
 );

 await api.notifications.show(
 `Track ${count}: ${track.title}`,
 'info'
 );
 }
 );
 },

 async deactivate() {
 }
};