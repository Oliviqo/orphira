const { app } = require('electron');

/**
 * ORPHIRA - CENTRAL APPLICATION IDENTITY
 *
 * Единственный источник истины для идентичности приложения
 * внутри исполняемого Main / Preload / Renderer pipeline.
 */
const APP_NAME = 'Orphira';
const APP_ID = 'com.orphira.player';
const PROJECT_URL = 'https://github.com/Oliviqo/orphira';
const CONTACT_URL = 'https://github.com/Oliviqo/orphira/issues';
const CONTACT_EMAIL = 'orphiraplayer@gmail.com';
const COPYRIGHT = 'Copyright (c) 2026 Olivia Løvgreen';

function getVersion() {
  return app ? app.getVersion() : '1.2.6';
}

function getUserAgent() {
  return `${APP_NAME}/${getVersion()} (${PROJECT_URL}; ${CONTACT_URL})`;
}

function getPublicIdentity() {
  return {
    name: APP_NAME,
    appId: APP_ID,
    version: getVersion(),
    projectUrl: PROJECT_URL,
    contactUrl: CONTACT_URL,
    contactEmail: CONTACT_EMAIL,
    copyright: COPYRIGHT
  };
}

module.exports = {
  APP_NAME,
  APP_ID,
  PROJECT_URL,
  CONTACT_URL,
  CONTACT_EMAIL,
  COPYRIGHT,
  getVersion,
  getUserAgent,
  getPublicIdentity
};