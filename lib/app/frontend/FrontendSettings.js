/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @ts-check
const fsEx = require('fs-extra')
const SETTINGS_FRONTEND_FILE = 'frontend.json'
const path = require('path')
const logger = require('../../logger')

class FrontendSettings {
  /**
   * @param {string} settingsFolder
   */
  constructor (settingsFolder) {
    this.settingsFolder = settingsFolder
    this.frontendSettingsFile = path.join(this.settingsFolder, SETTINGS_FRONTEND_FILE)
  }

  /**
   * Returns the IP address from the settings.
   * @return {Promise<string>}
   */
  async getIpAddress () {
    return (await this.loadSettings()).ip
  }

  /**
   * Returns the port from the settings.
   * @return {Promise<number>}
   */
  async getPort () {
    return (await this.loadSettings()).port
  }

  /**
   * Returns the API port from the settings.
   * @return {Promise<number>}
   */
  async getApiPort () {
    return (await this.loadSettings()).apiPort
  }

  /**
   * Returns the HMR port from the settings.
   * @return {Promise<number>}
   */
  async getHmrPort () {
    return (await this.loadSettings()).hmrPort
  }

  /**
   * Returns the Remote Dev Tools port from the settings.
   * @return {Promise<number>}
   */
  async getRemotePort () {
    return (await this.loadSettings()).remotePort
  }

  /**
   * Returns the access token from the settings.
   * @async
   * @return {Promise<string>}
   */
  async getAccessToken () {
    return (await this.loadSettings()).accessToken
  }

  /**
   * Returns the source map type for the settings.
   * @return {Promise<string>}
   */
  async getSourceMapsType () {
    return (await this.loadSettings()).sourceMapsType
  }

  /**
   * Sets the IP address.
   * @param {string} ip The local IP address
   */
  async setIpAddress (ip) {
    const settings = (await this.loadSettings())
    settings.ip = ip
    await this._saveSettings(settings)
  }

  /**
   * Sets the server port.
   * @param {number} port The Rapid Dev Server port.
   */
  async setPort (port) {
    const settings = (await this.loadSettings())
    settings.port = port
    await this._saveSettings(settings)
  }

  /**
   * Sets the API server port.
   * @param {number} apiPort The Rapid Dev Server port.
   */
  async setApiPort (apiPort) {
    const settings = (await this.loadSettings())
    settings.apiPort = apiPort
    await this._saveSettings(settings)
  }

  /**
   * Sets the HMR port.
   * @param {number} hmrPort The Hot Module Replacement port.
   */
  async setHmrPort (hmrPort) {
    const settings = (await this.loadSettings())
    settings.hmrPort = hmrPort
    await this._saveSettings(settings)
  }

  /**
   * Sets the Remote Dev Tools port.
   * @param {number} remotePort The Remote Dev Tools port.
   */
  async setRemotePort (remotePort) {
    const settings = (await this.loadSettings())
    settings.remotePort = remotePort
    await this._saveSettings(settings)
  }

  /**
   * Sets the access token.
   * @param {string} accessToken The jenkins access token.
   */
  async setAccessToken (accessToken) {
    const settings = (await this.loadSettings())
    settings.accessToken = accessToken
    await this._saveSettings(settings)
  }

  /**
   * Sets the source map type.
   * @param {string} sourceMapsType The source maps type.
   */
  async setSourceMapsType (sourceMapsType) {
    const settings = (await this.loadSettings())
    settings.sourceMapsType = sourceMapsType
    await this._saveSettings(settings)
  }

  /**
   * @param  {FrontendJson} settings
   * @return {Promise<void>}
   */
  async _saveSettings (settings) {
    await fsEx.ensureDir(this.settingsFolder)
    await fsEx.writeJson(this.frontendSettingsFile, settings, {spaces: 2})
  }

  /**
   * @return {Promise<FrontendJson>}
   */
  async loadSettings () {
    let settings = {}
    try {
      settings = await fsEx.readJson(this.frontendSettingsFile)
    } catch (err) {
      logger.debug(err.message)
      return settings
    }
    // @ts-ignore
    return settings
  }
}

module.exports = FrontendSettings
