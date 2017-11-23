const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const logger = require('../logger')

const EXTENSION_FOLDER = 'extensions'
const EXTENSION_CONFIG = 'extension-config.json'

class ExtensionAction {
  /**
   * @param {Command} commander
   */
  register (commander) {
    commander
      .command('extension <action> [extensions...]')
      .description('attaches or detaches one or more extensions')
      .action(this.run.bind(this))
  }

  /**
   * @param {String} action
   * @param {String[]} [extensions]
   */
  run (action, extensions) {
    if (!UserSettings.getInstance().getSession().getToken()) throw new Error('not logged in')
    this.settings = AppSettings.getInstance()

    switch (action) {
      case 'attach':
        this.attachExtensions(extensions || [])
        break
      case 'detach':
        this.detachExtensions(extensions || [])
        break
      default:
        throw new Error(`unknown action "${action}"`)
    }
  }

  /**
   * @param {String[]} extensions
   */
  attachExtensions (extensions) {
    let force = false
    if (!extensions.length) {
      extensions = this.getAllExtensions()
      force = true
    }

    extensions.forEach(ext => {
      const id = this.getExtensionId(ext)
      if (id) this.settings.attachExtension(ext, id, force)
    })
    this.settings.save()
  }

  /**
   * @param {String[]} extensions
   */
  detachExtensions (extensions) {
    if (!extensions.length) {
      this.settings.detachAllExtensions().save()
    } else {
      const extIds = extensions.map(ext => this.getExtensionId(ext))
      extIds.forEach(id => this.settings.detachExtension(id))
      this.settings.save()
    }
  }

  /**
   * @return {String[]} extensionId[]
   */
  getAllExtensions () {
    const files = fsEx.readdirSync(EXTENSION_FOLDER)
    const exts = []
    files.forEach(file => {
      if (!file.startsWith('.') && this.getExtensionId(file)) exts.push(file)
    })
    return exts
  }

  /**
   * @param {String } extensionName
   * @return {String} extensionId
   */
  getExtensionId (extensionName) {
    const file = path.join(EXTENSION_FOLDER, extensionName, EXTENSION_CONFIG)
    try {
      const json = fsEx.readJSONSync(file)
      if (json.id) return json.id
      logger.warn(`"${file}" has no "id"`)
    } catch (e) {
      logger.warn(`"${file}" is not existent or invalid json`)
    }
  }
}

module.exports = ExtensionAction
