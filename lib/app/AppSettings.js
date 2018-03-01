/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @ts-check
const path = require('path')
const FrontendSettings = require('./frontend/FrontendSettings')
const logger = require('../logger')
const fsEx = require('fs-extra')
const { SETTINGS_FOLDER } = require('./Constants')

class AppSettings {
  /**
   * @param {string} applicationFolder
   */
  constructor (applicationFolder) {
    this.applicationFolder = applicationFolder
    this.settingsFolder = path.join(this.applicationFolder, SETTINGS_FOLDER)
    this.settingsFile = path.join(this.settingsFolder, 'app.json')
    this.attachedExtensionsFile = path.join(this.settingsFolder, 'attachedExtensions.json')
    this.frontendSettings = new FrontendSettings(path.join(this.settingsFolder))
  }

  /**
   * @returns {string}
   */
  getApplicationFolder () {
    return this.applicationFolder
  }

  /**
   * @returns {Promise<AppSettings>}
   */
  async validate () {
    await this.getId()
    return this
  }

  /**
   * @returns {Promise<string>}
   */
  async getId () {
    const data = await this._loadSettings()
    if (!data.id) throw new Error('The current folder seems not to be a sgcloud project. Please run sgcloud init first.')
    return data.id
  }

  /**
   * @param {string} id
   * @returns {Promise<AppSettings>}
   */
  async setId (id) {
    const data = await this._loadSettings()
    data.id = id
    await fsEx.ensureDir(this.settingsFolder)
    await fsEx.writeJson(this.settingsFile, data, {spaces: 2})
    return this
  }

  /**
   * @param {Object.<string, AttachedExtension>} extensions
   * @returns {Promise<AppSettings>}
   * @private
   */
  async _saveExtensions (extensions) {
    await fsEx.ensureDir(this.settingsFolder)
    await fsEx.writeJson(this.attachedExtensionsFile, {attachedExtensions: extensions})
    return this
  }

  /**
   * Attaches a extension
   * @param {string} pathName
   * @param {ExtensionInfo} extensionInfo
   * @param {Boolean} [force=false]
   * @returns {Promise<AppSettings>}
   */
  async attachExtension (pathName, extensionInfo, force) {
    let extensions
    try {
      extensions = await this.loadAttachedExtensions()
    } catch (err) {
      logger.debug('attachedExtensions.json not found; creating...')
      extensions = {}
    }

    if (!force && extensions[extensionInfo.id]) throw new Error(`Extension '${extensionInfo.id} (${pathName}) is already attached`)

    extensions[extensionInfo.id] = {path: pathName, trusted: extensionInfo.trusted}
    await this._saveExtensions(extensions)
    logger.info(`Attached ${extensionInfo.id} (${pathName})`)
    return this
  }

  /**
   * Detaches an extension
   * @param {string} extensionId
   * @return {Promise<AppSettings>}
   */
  async detachExtension (extensionId) {
    let extensions
    try {
      extensions = await this.loadAttachedExtensions()
    } catch (err) {
      logger.debug('attachedExtensions.json not found; creating...')
      extensions = {}
    }
    if (!extensions[extensionId]) {
      logger.warn(`The extension '${extensionId}' is not attached`)
      return this
    }

    delete extensions[extensionId]
    await this._saveExtensions(extensions)
    logger.info(`Detached ${extensionId}`)
    return this
  }

  /**
   * @returns {Promise<Object.<string, AttachedExtension>>} A key-value hash with extension IDs as key and extension configurations as values.
   */
  async loadAttachedExtensions () {
    const config = await fsEx.readJson(this.attachedExtensionsFile, {throws: false}) || {}
    return config.attachedExtensions || {}
  }

  /**
   * Detaches all extensions
   * @returns {Promise<AppSettings>}
   */
  async detachAllExtensions () {
    await this._saveExtensions({})
    logger.info('Detached all extensions')
    return this
  }

  /**
   * @returns {Promise<AppJson>}
   */
  async _loadSettings () {
    try {
      const settings = await fsEx.readJson(this.settingsFile, {throws: false})
      return settings || {}
    } catch (err) {
      return {}
    }
  }

  /**
   * @returns {FrontendSettings}
   */
  getFrontendSettings () {
    return this.frontendSettings
  }
}

module.exports = AppSettings
