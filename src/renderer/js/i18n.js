/**
 * COSMIC PLAYER - I18N LOCALIZATION ENGINE
 * Система многоязычности с автоматическим поиском файлов локалей и реактивным обновлением UI
 */
class I18n {
  constructor() {
    this.currentLang = 'en';
    this.locales = {};
  }

  async init(lang = 'en') {
    await this.setLanguage(lang);
  }

  async setLanguage(lang) {
    if (!this.locales[lang]) {
      const pathsToTry = [
        `../locales/${lang}.json`,
        `./locales/${lang}.json`,
        `../../locales/${lang}.json`
      ];
      let loaded = false;
      for (const path of pathsToTry) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            this.locales[lang] = await response.json();
            loaded = true;
            break;
          }
        } catch (e) {}
      }
      if (!loaded) {
        console.warn(`[i18n] Не удалось загрузить файл локали: ${lang}.json`);
      }
    }
    this.currentLang = lang;
    if (window.api?.media?.syncTrayLang) {
      window.api.media.syncTrayLang(lang);
    }
    this.updateDOM();

    // Реактивное обновление динамических компонентов при смене языка
    if (window.Equalizer) {
      window.Equalizer.renderPresetsDropdown();
      const btnBypass = document.getElementById('btn-eq-bypass');
      if (btnBypass) window.Equalizer._updateBypassUI(btnBypass);
    }

 if (window.Search) window.Search.syncContext();

    if (window.LibraryViews) window.LibraryViews.updateHeaderInfo();
    if (window.Tracklist) window.Tracklist.render();
    if (window.Playlists) window.Playlists.render();
 if (window.QueuePanel) window.QueuePanel.update();

 if (
 window.ArtistView?.isOpen
 ) {
 window.ArtistView.render();
 }

 if (window.PluginRuntime) {
 window.PluginRuntime.emit('app.languageChanged', {
 language: lang
 });
 }
 }

 t(key) {
 const current =
 this.locales[
 this.currentLang
 ] || {};

 const fallback =
 this.locales.en || {};

 const value =
 current[key] ??
 fallback[key] ??
 key;

 const appName =
 window.state
 ?.appIdentity
 ?.name ||
 'Orphira';

 return String(value)
 .replace(
 /\{appName\}/g,
 appName
 );
 }

  updateDOM() {
    // Текстовое содержимое тегов
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);
      if (translation && translation !== key) el.textContent = translation;
    });

    // Плейсхолдеры полей ввода
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translation = this.t(key);
      if (translation && translation !== key) el.setAttribute('placeholder', translation);
    });

    // Подсказки атрибута title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translation = this.t(key);
      if (translation && translation !== key) el.setAttribute('title', translation);
    });
  }
}

window.i18n = new I18n();