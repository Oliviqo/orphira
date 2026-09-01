/**
 * ORPHIRA - APPLICATION UPDATE UI
 *
 * Renderer presentation layer для Update Engine.
 * Сетевые запросы и установка обновлений выполняются
 * исключительно Main Process.
 */
class OrphiraUpdateUI {
 constructor() {
 this.state = {
 supported: false,
 status: 'idle',
 currentVersion: '',
 availableVersion: null,
 releaseName: null,
 releaseNotes: null,
 releaseDate: null,
 percent: 0,
 error: null
 };
 this.initialized = false;
 }

 async init() {
 if (this.initialized) {
 return;
 }

 this.initialized = true;

 if (!window.api?.update) {
 return;
 }

 if (
 typeof window.api.update.onState ===
 'function'
 ) {
 window.api.update.onState(
 state => {
 this.setState(state);
 }
 );
 }

 try {
 const state =
 await window.api.update.getState();

 if (state) {
 this.setState(state);
 }
 } catch (error) {
 console.warn(
 '[UpdateUI] Unable to read update state:',
 error
 );
 }
 }

 setState(state) {
 if (
 !state ||
 typeof state !== 'object'
 ) {
 return;
 }

 this.state = {
 ...this.state,
 ...state
 };

 this.renderIndicators();
 this.renderAboutCard();
 }

 hasAvailableUpdate() {
 return [
 'available',
 'downloading',
 'downloaded'
 ].includes(
 this.state.status
 );
 }

 renderIndicators() {
 const settingsButton =
 document.getElementById(
 'btn-mode-settings'
 );

 const aboutNav =
 document.querySelector(
 '#sidebar-settings-view [data-settings-cat="about"]'
 );

 this._syncIndicator(
 settingsButton,
 'settings-update-indicator'
 );

 this._syncIndicator(
 aboutNav,
 'about-update-indicator'
 );
 }

 _syncIndicator(
 host,
 indicatorClass
 ) {
 if (!host) {
 return;
 }

 let indicator =
 host.querySelector(
 `.${indicatorClass}`
 );

 if (!this.hasAvailableUpdate()) {
 if (indicator) {
 indicator.remove();
 }
 return;
 }

 if (!indicator) {
 indicator =
 document.createElement('span');

 indicator.className =
 `update-attention-dot ${indicatorClass}`;

 indicator.setAttribute(
 'aria-hidden',
 'true'
 );

 host.appendChild(
 indicator
 );
 }
 }

 renderAboutCard() {
 const container =
 document.getElementById(
 'settings-view-container'
 );

 if (
 !container ||
 window.SettingsView?.currentCat !==
 'about'
 ) {
 return;
 }

 let card =
 container.querySelector(
 '#orphira-update-card'
 );

 if (!card) {
 card =
 document.createElement('div');

 card.id =
 'orphira-update-card';

 card.className =
 'settings-card orphira-update-card';

 const firstGroup =
 container.querySelector(
 '.settings-group-block'
 );

 if (firstGroup) {
 firstGroup.insertBefore(
 card,
 firstGroup.firstChild
 );
 } else {
 container.appendChild(
 card
 );
 }
 }

 this._renderCardContent(
 card
 );
 }

 _renderCardContent(card) {
 const status =
 this.state.status;

 const currentVersion =
 this.state.currentVersion ||
 window.state?.appVersion ||
 '';

 const availableVersion =
 this.state.availableVersion ||
 '';

 const title =
 this._translate(
 'update_available_title',
 'Update Available'
 );

 let description =
 this._translate(
 'update_current_version',
 'Current version: {version}'
 )
 .replace(
 '{version}',
 currentVersion
 );

 let buttonText =
 this._translate(
 'update_check_now',
 'Check for Updates'
 );

 let buttonAction =
 'check';

 let buttonDisabled =
 false;

 let showAttention =
 false;

 if (
 status === 'checking'
 ) {
 buttonText =
 this._translate(
 'update_checking',
 'Checking...'
 );
 buttonDisabled = true;
 } else if (
 status === 'available'
 ) {
 description =
 this._translate(
 'update_version_available',
 'Version {version} is available.'
 )
 .replace(
 '{version}',
 availableVersion
 );

 buttonText =
 this._translate(
 'update_download',
 'Download Update'
 );

 buttonAction =
 'download';

 showAttention = true;
 } else if (
 status === 'downloading'
 ) {
 const percent =
 Math.max(
 0,
 Math.min(
 100,
 Number(this.state.percent) || 0
 )
 );

 description =
 this._translate(
 'update_downloading_progress',
 'Downloading update: {percent}%'
 )
 .replace(
 '{percent}',
 String(
 Math.round(percent)
 )
 );

 buttonText =
 this._translate(
 'update_downloading',
 'Downloading...'
 );

 buttonDisabled = true;
 showAttention = true;
 } else if (
 status === 'downloaded'
 ) {
 description =
 this._translate(
 'update_ready_version',
 'Version {version} is ready to install.'
 )
 .replace(
 '{version}',
 availableVersion
 );

 buttonText =
 this._translate(
 'update_restart_install',
 'Restart and Install'
 );

 buttonAction =
 'install';

 showAttention = true;
 } else if (
 status === 'unsupported'
 ) {
 description =
 this._translate(
 'update_packaged_only',
 'Update checks are available in the installed version of Orphira.'
 );

 buttonText =
 this._translate(
 'update_unavailable_dev',
 'Unavailable in Development'
 );

 buttonDisabled = true;
 } else if (
 status === 'error'
 ) {
 description =
 this._translate(
 'update_check_failed',
 'Unable to check for updates right now.'
 );

 buttonText =
 this._translate(
 'update_try_again',
 'Try Again'
 );

 buttonAction =
 'check';
 } else {
 description =
 this._translate(
 'update_up_to_date',
 'Orphira is up to date. Current version: {version}'
 )
 .replace(
 '{version}',
 currentVersion
 );

 buttonText =
 this._translate(
 'update_check_now',
 'Check for Updates'
 );

 buttonAction =
 'check';
 }

 card.classList.toggle(
 'has-update',
 showAttention
 );

 const releaseNotes =
 this._getReleaseNotes();

 card.innerHTML = `
 <div class="settings-row">
 <div class="settings-info">
 <span class="settings-label">
 ${showAttention ? '<span class="update-attention-dot update-card-dot" aria-hidden="true"></span>' : ''}
 <span data-i18n="update_available_title">${window.escapeHTML(title)}</span>
 </span>
 <span class="settings-desc">${window.escapeHTML(description)}</span>
 </div>
 <div class="settings-control">
 <button
 class="custom-btn orphira-update-action"
 type="button"
 ${buttonDisabled ? 'disabled' : ''}
 >
 ${window.escapeHTML(buttonText)}
 </button>
 </div>
 </div>
 ${status === 'downloading' ? this._createProgressMarkup() : ''}
 ${releaseNotes}
 `;

 const button =
 card.querySelector(
 '.orphira-update-action'
 );

 if (
 button &&
 !buttonDisabled
 ) {
 button.addEventListener(
 'click',
 () => {
 this._handleAction(
 buttonAction
 );
 }
 );
 }
 }

 _getReleaseNotes() {
 const notes =
 String(
 this.state.releaseNotes ||
 ''
 )
 .trim();

 if (!notes) {
 return '';
 }

 return `
 <div class="orphira-update-notes">
 <div class="orphira-update-notes-title">${window.escapeHTML(
 this._translate(
 'update_whats_new',
 "What's New"
 )
 )}</div>
 <div class="orphira-update-notes-text">${window.escapeHTML(notes)}</div>
 </div>
 `;
 }

 _createProgressMarkup() {
 const percent =
 Math.max(
 0,
 Math.min(
 100,
 Number(this.state.percent) || 0
 )
 );

 return `
 <div class="orphira-update-progress">
 <div
 class="orphira-update-progress-fill"
 style="width: ${percent.toFixed(2)}%;"
 ></div>
 </div>
 `;
 }

 async _handleAction(action) {
 try {
 if (action === 'check') {
 await window.api.update.check();
 return;
 }

 if (action === 'download') {
 await window.api.update.download();
 return;
 }

 if (action === 'install') {
 await window.api.update.install();
 }
 } catch (error) {
 console.warn(
 '[UpdateUI] Update action failed:',
 error
 );
 }
 }

 _translate(key, fallback) {
 const translated =
 window.i18n?.t(key);

 if (
 translated &&
 translated !== key
 ) {
 return translated;
 }

 return fallback;
 }
}

window.UpdateUI =
 new OrphiraUpdateUI();