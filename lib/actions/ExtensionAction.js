const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')

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
    if (!extensions.length) {
      this.settings.attachExtensions(this.getAllExtensions(), true).save()
    } else {
      this.settings.attachExtensions(extensions.filter(ext => this.extensionExists(ext))).save()
    }
  }

  /**
   * @param {String[]} extensions
   */
  detachExtensions (extensions) {
    if (!extensions.length) {
      this.settings.detachAllExtensions().save()
    } else {
      this.settings.detachExtensions(extensions).save()
    }
  }

  /**
   * @return {String[]} extensionId[]
   */
  getAllExtensions () {
    const files = fsEx.readdirSync(EXTENSION_FOLDER)
    return files.map(f => this.getExtensionId(f)).filter(valid => valid)
  }

  /**
   * @param {String }extensionName
   * @return {String} extensionId
   */
  getExtensionId (extensionName) {
    const json = fsEx.readJSONSync(path.join(EXTENSION_FOLDER, extensionName, EXTENSION_CONFIG))
    if (json.id) return json.id
    else throw new Error(`Config file of '${extensionName}' is invalid`)
  }

  /**
   * @param {String} extensionName
   * @return {String} extensionId
   */
  extensionExists (extensionName) {
    if (fsEx.pathExistsSync(EXTENSION_FOLDER, extensionName, EXTENSION_CONFIG)) {
      return this.getExtensionId(extensionName)
    } else {
      throw new Error(`Extension '${extensionName}' does not exist locally`)
    }
  }
}

module.exports = ExtensionAction
