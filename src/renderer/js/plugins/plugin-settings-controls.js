class OrphiraPluginSettingsControls {
 async buildSections() {
 const fragment =
 document.createDocumentFragment();

 const sections =
 window.PluginRuntime
 ?.getSettingsSections() ||
 [];

 for (
 const section
 of sections
 ) {
 const block =
 document.createElement(
 'div'
 );

 block.className =
 'settings-group-block';

 const title =
 document.createElement(
 'div'
 );

 title.className =
 'settings-group-header';

 title.innerHTML = `
 <span class="settings-group-title">${window.escapeHTML(section.title || section.id)}</span>
 `;

 block.appendChild(
 title
 );

 const card =
 document.createElement(
 'div'
 );

 card.className =
 'settings-card';

 for (
 const control
 of section.controls || []
 ) {
 card.appendChild(
 await this.buildControl(
 section,
 control
 )
 );
 }

 block.appendChild(card);
 fragment.appendChild(block);
 }

 return fragment;
 }

 async buildControl(
 section,
 control
 ) {
 const row =
 document.createElement(
 'div'
 );

 row.className =
 'settings-row';

 const info =
 document.createElement(
 'div'
 );

 info.className =
 'settings-info';

 const label =
 document.createElement(
 'span'
 );

 label.className =
 'settings-label';

 label.textContent =
 String(
 control.label ||
 control.id ||
 ''
 );

 const desc =
 document.createElement(
 'span'
 );

 desc.className =
 'settings-desc';

 desc.textContent =
 String(
 control.description ||
 ''
 );

 info.appendChild(label);
 info.appendChild(desc);

 const holder =
 document.createElement(
 'div'
 );

 holder.className =
 'settings-control';

 const storedKey =
 `setting.${section.id}.${control.id}`;

 let value =
 control.default;

 try {
 const saved =
 await window.api.plugins
 .settingGet(
 section.pluginId,
 storedKey
 );

 if (
 saved !== null &&
 saved !== undefined
 ) {
 value = saved;
 }
 } catch (error) {
 }

 const commit =
 async newValue => {
 value = newValue;

 try {
 await window.api.plugins
 .settingSet(
 section.pluginId,
 storedKey,
 newValue
 );
 } catch (error) {
 }

 if (
 control.callbackId
 ) {
 await window.PluginRuntime
 .invokeCallback(
 {
 pluginId:
 section.pluginId,
 callbackId:
 control.callbackId
 },
 {
 id:
 control.id,
 value:
 newValue
 }
 );
 }
 };

 if (
 control.type ===
 'toggle'
 ) {
 const toggle =
 document.createElement(
 'label'
 );

 toggle.className =
 'toggle-switch';

 toggle.innerHTML = `
 <input type="checkbox">
 <span class="toggle-slider"></span>
 `;

 const input =
 toggle.querySelector(
 'input'
 );

 input.checked =
 Boolean(value);

 input.addEventListener(
 'change',
 () =>
 commit(
 input.checked
 )
 );

 holder.appendChild(toggle);
 } else if (
 control.type ===
 'select'
 ) {
 const select =
 document.createElement(
 'select'
 );

 select.className =
 'plugin-native-select';

 for (
 const option
 of control.options || []
 ) {
 const el =
 document.createElement(
 'option'
 );

 el.value =
 String(
 option.value
 );

 el.textContent =
 String(
 option.label ??
 option.value
 );

 if (
 String(value) ===
 String(option.value)
 ) {
 el.selected = true;
 }

 select.appendChild(el);
 }

 select.addEventListener(
 'change',
 () =>
 commit(
 select.value
 )
 );

 holder.appendChild(select);
 } else if (
 control.type ===
 'slider'
 ) {
 const input =
 document.createElement(
 'input'
 );

 input.type = 'range';

 input.min =
 String(
 control.min ?? 0
 );

 input.max =
 String(
 control.max ?? 100
 );

 input.step =
 String(
 control.step ?? 1
 );

 input.value =
 String(
 value ??
 control.min ??
 0
 );

 const output =
 document.createElement(
 'span'
 );

 output.className =
 'settings-slider-val';

 output.textContent =
 input.value;

 input.addEventListener(
 'input',
 () => {
 output.textContent =
 input.value;

 commit(
 Number(
 input.value
 )
 );
 }
 );

 holder.appendChild(input);
 holder.appendChild(output);
 } else {
 const input =
 document.createElement(
 'input'
 );

 input.type =
 control.type ===
 'password'
 ? 'password'
 : 'text';

 input.className =
 'plugin-setting-input';

 input.value =
 String(value ?? '');

 input.placeholder =
 String(
 control.placeholder ||
 ''
 );

 input.addEventListener(
 'change',
 () =>
 commit(
 input.value
 )
 );

 holder.appendChild(input);
 }

 row.appendChild(info);
 row.appendChild(holder);

 return row;
 }
}

window.PluginSettingsControls =
 new OrphiraPluginSettingsControls();