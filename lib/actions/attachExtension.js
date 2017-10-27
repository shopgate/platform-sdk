const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const logger = require('../logger')

const EXTENSION_FOLDER = 'extensions'
const EXTENSION_CONFIG = 'settings.json'

function attachExtension (extensions) {
  if (!UserSettings.getInstance().getSession().hasToken()) throw new Error('not logged in')

  // Throws error if not in app folder
  const settings = AppSettings.getInstance()

  // If no extension specified, add all local
  if (!extensions.length) {
    getAllExtensions(extensions)
      .forEach(extension => {
        settings.attachExtension(extension)
        logger.info(`Added '${extension}'`)
      })
    settings.save()
    return
  }

  settings.attachExtensions(extensions.filter(ext => extensionExists(ext))).save()
}

/**
 * Checks if a extension exists
 * @returns {string} extensionId
*/
function extensionExists (name) {
  if (fsEx.pathExistsSync(EXTENSION_FOLDER, name, EXTENSION_CONFIG)) {
    return isValidExtension(name)
  } else {
    throw new Error(`Extension '${name}' does not exist locally`)
  }
}

/**
 * Returns all local extensions, that are valid
 */
function getAllExtensions () {
  const files = fsEx.readdirSync(EXTENSION_FOLDER)
  return files.map(f => isValidExtension(f)).filter(valid => valid)
}

/**
 * Checks if the settings.json contains a id
 * @param extensionName
 * @return {string} extensionId
 */
function isValidExtension (extensionName) {
  const json = fsEx.readJSONSync(path.join(EXTENSION_FOLDER, extensionName, EXTENSION_CONFIG))
  if (json.id) return json.id
  else throw new Error(`Config file of '${extensionName}' is invalid`)
}

module.exports = attachExtension
module.exports.cmd = commander => {
  commander
    .command('extension attach [extensionNames...]')
    .description('attaches one or more extensions')
    .action(attachExtension)
}
