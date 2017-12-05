/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fsEx = require('fs-extra')
const SETTINGS_FRONTEND_FILE = 'frontend.json'
const path = require('path')

class FrontendSettings {
  /**
   * @param {Object} settings The frontend settings
   */
  constructor (settingsFolder) {
    this.settingsFolder = settingsFolder
    this.frontendSettingsFile = path.join(this.settingsFolder, SETTINGS_FRONTEND_FILE)
  }

  /**
   * Returns the IP address from the settings.
   * @return {string}
   */
  getIpAddress () {
    return this._loadSettings().ip
  }

  /**
   * Returns the port from the settings.
   * @return {Number}
   */
  getPort () {
    return this._loadSettings().port
  }

  /**
   * Returns the API port from the settings.
   * @return {Number}
   */
  getApiPort () {
    return this._loadSettings().apiPort
  }

  /**
   * Returns the HMR port from the settings.
   * @return {Number}
   */
  getHmrPort () {
    return this._loadSettings().hmrPort
  }

  /**
   * Returns the Remote Dev Tools port from the settings.
   * @return {Number}
   */
  getRemotePort () {
    return this._loadSettings().remotePort
  }

  /**
   * Returns the access token from the settings.
   * @return {string}
   */
  getAccessToken () {
    return this._loadSettings().accessToken
  }

  /**
   * Returns the source map type for the settings.
   * @return {string}
   */
  getSourceMapsType () {
    return this._loadSettings().sourceMapsType
  }

  /**
   * Sets the IP address.
   * @param {string} ip The local IP address
   * @return {FrontendSettings}
   */
  setIpAddress (ip) {
    const settings = this._loadSettings()
    settings.ip = ip
    return this._saveSettings(settings)
  }

  /**
   * Sets the server port.
   * @param {Number} port The Rapid Dev Server port.
   * @return {FrontendSettings}
   */
  setPort (port) {
    const settings = this._loadSettings()
    settings.port = port
    return this._saveSettings(settings)
  }

  /**
   * Sets the API server port.
   * @param {Number} apiPort The Rapid Dev Server port.
   * @return {FrontendSettings}
   */
  setApiPort (apiPort) {
    const settings = this._loadSettings()
    settings.apiPort = apiPort
    return this._saveSettings(settings)
  }

  /**
   * Sets the HMR port.
   * @param {Number} hmrPort The Hot Module Replacement port.
   * @return {FrontendSettings}
   */
  setHmrPort (hmrPort) {
    const settings = this._loadSettings()
    settings.hmrPort = hmrPort
    return this._saveSettings(settings)
  }

  /**
   * Sets the Remote Dev Tools port.
   * @param {Number} remotePort The Remote Dev Tools port.
   * @return {FrontendSettings}
   */
  setRemotePort (remotePort) {
    const settings = this._loadSettings()
    settings.remotePort = remotePort
    return this._saveSettings(settings)
  }

  /**
   * Sets the access token.
   * @param {string} accessToken The jenkins access token.
   * @return {FrontendSettings}
   */
  setAccessToken (accessToken) {
    const settings = this._loadSettings()
    settings.accessToken = accessToken
    return this._saveSettings(settings)
  }

  /**
   * Sets the source map type.
   * @param {string} sourceMapsType The source maps type.
   * @return {FrontendSettings}
   */
  setSourceMapsType (sourceMapsType) {
    const settings = this._loadSettings()
    settings.sourceMapsType = sourceMapsType
    return this._saveSettings(settings)
  }

  _saveSettings (settings) {
    fsEx.ensureDirSync(this.settingsFolder)
    fsEx.writeJsonSync(this.frontendSettingsFile, settings, {spaces: 2})
    return this
  }

  _loadSettings () {
    return fsEx.readJsonSync(this.frontendSettingsFile, {throws: false}) || {}
  }
}

module.exports = FrontendSettings
