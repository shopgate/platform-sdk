const logger = require('../logger')
const fsEx = require('fs-extra')
const path = require('path')

/**
 * Returns all the sub dirs of a directory
 * @param {*} path
 */
function getDirectories (dirPath) {
  if (!fsEx.pathExistsSync(dirPath)) {
    logger.debug(`directory ${dirPath} does not exist`)
    return []
  }
  return fsEx.readdirSync(dirPath).map(name => path.join(dirPath, name)).filter(dir => fsEx.lstatSync(dir).isDirectory())
}

/**
 * Removes a file if it exists
 * @param {*} path
 */
function removeIfExists (path) {
  if (fsEx.pathExistsSync(path)) {
    fsEx.removeSync(path)
  } else {
    logger.debug(`file: ${path} does not exist`)
  }
}

/**
 * Resets the current project
 */
function resetProject () {
  const appPath = process.env.APP_PATH ? process.env.APP_PATH : ''

  removeIfExists(path.join(appPath, '.sgcloud', 'app.json'))
  removeIfExists(path.join(appPath, '.sgcloud', 'storage.json'))
  removeIfExists(path.join(appPath, '.sgcloud', 'attachedExtension.json'))

  const extensionsDir = path.join(appPath, 'extensions')
  const extensionDirs = getDirectories(extensionsDir)
  extensionDirs.forEach(extensionDir => removeIfExists(path.join(extensionDir, 'extension', 'config.json')))

  const themesDir = path.join(appPath, 'themes')
  const themeDirs = getDirectories(themesDir)
  themeDirs.forEach(themeDir => removeIfExists(path.join(themeDir, 'config', 'app.json')))
}

module.exports = { resetProject }
