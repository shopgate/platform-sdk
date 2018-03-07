/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
// @ts-check
const path = require('path')
const async = require('async')
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
    this._queue = async.queue(async (task, callback) => {
      const execute = task.execute.bind(this)
      const resolve = task.resolve.bind(this)
      const reject = task.reject.bind(this)

      try {
        const data = await execute()
        return resolve(data)
      } catch (error) {
        return reject(error)
      }
    })
    this.locked = false
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
    await fsEx.writeJson(this.settingsFile, data, { spaces: 2 })
    return this
  }

  /**
   * @param {Object.<string, AttachedExtension>} extensions
   * @returns {Promise<AppSettings>}
   * @private
   */
  async _saveExtensions (extensions) {
    return this._queuedWriteOperation({ attachedExtensions: extensions })
  }

  /**
   * @param {Object} content
   * @param {Object.<string, AttachedExtension>} content.attachedExtensions
   * @returns {Promise<void>}
   * @private
   */
  async _writeExtensionFile (content) {
    await fsEx.ensureDir(this.settingsFolder)
    await fsEx.writeJson(this.attachedExtensionsFile, content)
  }

  /**
   * @returns {Promise<Object.<string, AttachedExtension>>}
   */
  async _readExtensionFile () {
    await fsEx.ensureDir(this.settingsFolder)

    if (!await fsEx.pathExists(this.attachedExtensionsFile)) return {}

    const conf = await fsEx.readJson(this.attachedExtensionsFile)

    if (conf.attachedExtensions) {
      return conf.attachedExtensions
    } else {
      return {}
    }
  }

  /**
   * @param {Object} content
   * @returns {Promise<void>}
   */
  async _queuedWriteOperation (content) {
    this.extensionConfig = content
    return new Promise((resolve, reject) => {
      this._queue.push({ name: 'write', execute: async () => (this._writeExtensionFile(content)), resolve, reject })
    })
  }

  /**
   * @returns {Promise<Object.<string, AttachedExtension>>}
   */
  async _queuedReadOperation () {
    return new Promise((resolve, reject) => {
      this._queue.push({ name: 'read', execute: this._readExtensionFile, resolve, reject })
    })
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
      extensions = await this._queuedReadOperation()
    } catch (err) {
      logger.error(err)
      logger.debug('attachedExtensions.json not found; creating...')
      extensions = {}
    }

    if (!force && extensions[extensionInfo.id]) throw new Error(`Extension '${extensionInfo.id} (${pathName}) is already attached`)

    const attach = {}
    attach[extensionInfo.id] = { path: pathName, trusted: extensionInfo.trusted }
    await this._addExtension(attach)
    logger.info(`Attached ${extensionInfo.id} (${pathName})`)
    return this
  }

  /**
   * @param {string} extensionId
   * @returns {Promise<void>}
   */
  async _removeExtension (extensionId) {
    let extensions = await this._queuedReadOperation()
    delete extensions[extensionId]
    return this._queuedWriteOperation({ attachedExtensions: extensions })
  }

  /**
   * @param {Object<string, ExtensionInfo>} extensionInfo
   */
  async _addExtension (extensionInfo) {
    let extensions = await this._queuedReadOperation()
    const newContent = Object.assign({}, extensions, extensionInfo)
    return this._queuedWriteOperation({ attachedExtensions: newContent })
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

    await this._removeExtension(extensionId)
    logger.info(`Detached ${extensionId}`)
    return this
  }

  /**
   * @returns {Promise<Object.<string, AttachedExtension>>} A key-value hash with extension IDs as key and extension configurations as values.
   */
  async loadAttachedExtensions () {
    return new Promise((resolve, reject) => {
      this._queue.push({
        name: 'read',
        execute: this._readExtensionFile,
        resolve: (config) => {
          resolve(config)
        },
        reject: () => {
          return resolve({})
        }
      })
    })
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
   * @returns {Promise<AppJson|{}>}
   */
  async _loadSettings () {
    try {
      const settings = await fsEx.readJson(this.settingsFile, { throws: false })
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
