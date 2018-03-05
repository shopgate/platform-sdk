const logger = require('../logger')
const fsEx = require('fs-extra')
const path = require('path')
const findRoot = require('find-root')
const { SETTINGS_FOLDER, EXTENSIONS_FOLDER, THEMES_FOLDER, TRUSTED_PIPELINES_FOLDER, PIPELINES_FOLDER } = require('../app/Constants')

function filterDir (dirPath, filterFunction) {
  if (!fsEx.pathExistsSync(dirPath)) {
    logger.debug(`directory ${dirPath} does not exist`)
    return []
  }
  return fsEx.readdirSync(dirPath).map(name => path.join(dirPath, name)).filter(filterFunction)
}

/**
 * Returns all the sub dirs of a directory
 * @param {string} dirPath
 */
function getDirectories (dirPath) {
  return filterDir(dirPath, dir => fsEx.lstatSync(dir).isDirectory())
}

/**
 * Filters all files of a directory optional by fileEnding
 * @param {string} dirPath
 * @param {string} [fileEnding]
 */
function getFiles (dirPath, fileEnding) {
  return filterDir(dirPath, file => {
    if (!fsEx.lstatSync(file).isFile()) return false
    if (fileEnding) return file.endsWith(fileEnding)
    return true
  })
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
  const appPath = getApplicationFolder()

  removeIfExists(path.join(appPath, SETTINGS_FOLDER, 'app.json'))
  removeIfExists(path.join(appPath, SETTINGS_FOLDER, 'storage.json'))
  removeIfExists(path.join(appPath, SETTINGS_FOLDER, 'attachedExtension.json'))

  const extensionsDir = path.join(appPath, EXTENSIONS_FOLDER)
  const extensionDirs = getDirectories(extensionsDir)
  extensionDirs.forEach(extensionDir => removeIfExists(path.join(extensionDir, 'extension', 'config.json')))

  const themesDir = path.join(appPath, THEMES_FOLDER)
  const themeDirs = getDirectories(themesDir)
  themeDirs.forEach(themeDir => removeIfExists(path.join(themeDir, 'config', 'app.json')))
  themeDirs.forEach(themeDir => removeIfExists(path.join(themeDir, 'config', 'components.json')))

  const pipelinesDir = path.join(appPath, PIPELINES_FOLDER)
  const pipelineFiles = getFiles(pipelinesDir)
  pipelineFiles.forEach(pipelineFile => removeIfExists(pipelineFile))

  const trustedPipelinesDir = path.join(appPath, TRUSTED_PIPELINES_FOLDER)
  const trustedPipelineFiles = getFiles(trustedPipelinesDir)
  trustedPipelineFiles.forEach(trustedPipelineFile => removeIfExists(trustedPipelineFile))
}

/**
 * @param {string} processName
 * @param {int} pid
 * @param {string} dir
 */
async function setProcessFile (processName, dir, pid) {
  await fsEx.writeJson(path.join(dir, processName), {pid})
}

/**
 * @param {string} processName
 * @param {string} dir
 */
async function deleteProcessFile (processName, dir) {
  await fsEx.remove(path.join(dir, processName))
}

/**
 * Returns pid of previous process or null
 * @param {string} processName
 * @param {string} dir
 */
async function previousProcess (processName, dir) {
  const file = path.join(dir, processName)

  // There's no process file
  if (!await fsEx.pathExists(file)) return null

  let processFileContent
  try {
    processFileContent = await fsEx.readJson(file)
  } catch (e) {
    throw new Error('Cannot read process file')
  }

  if (!processFileContent.pid) throw new Error('Process file is invalid')

  try {
    const isRunning = process.kill(processFileContent.pid, 0)
    // File exists, pid has no process: must have been crashed
    if (!isRunning) await deleteProcessFile(processName, dir)
    return isRunning ? processFileContent.pid : null
  } catch (e) {
    return e.code === 'EPERM' ? processFileContent.pid : null
  }
}

function getApplicationFolder () {
  if (process.env.APP_PATH) return process.env.APP_PATH

  try {
    return findRoot(process.cwd(), (dir) => fsEx.existsSync(path.join(dir, '.sgcloud', 'app.json')))
  } catch (err) {
    // NOTE: workaround, find root would print "package.json not found in path"
    err.message = "Couldn't find application folder upwards"
    logger.debug(err)
  }

  return process.cwd()
}

/**
 * @param {AppSettings} appSettings
 */
function generateComponentsJson (appSettings) {
  const attachedExtensions = appSettings.loadAttachedExtensions()
  const appFolder = appSettings.getApplicationFolder()
  const extensionsFolder = path.join(appFolder, EXTENSIONS_FOLDER)

  const components = {}
  for (let extensionId in attachedExtensions) {
    const extensionPath = path.join(extensionsFolder, attachedExtensions[extensionId].path)

    const config = fsEx.readJsonSync(path.join(extensionPath, 'extension-config.json'))

    if (config.components && config.components.length > 0) {
      config.components.forEach((component) => {
        if (!component.type) return // skip when the type of the component is missing
        if (!components[component.type]) components[component.type] = {}
        components[component.type][`${extensionId}/${component.id}`] = {
          path: `${attachedExtensions[extensionId].path}/${component.path}`
        }

        if (component.target) components[component.type][`${extensionId}/${component.id}`].target = component.target
      })
    }
  }

  const themes = getDirectories(path.join(appFolder, THEMES_FOLDER))

  logger.info(`Generating components.json for ${themes}`)

  // write components.json for each theme
  themes.forEach((theme) => {
    if (!fsEx.existsSync(path.join(theme, 'extension-config.json'))) return
    const configDir = path.join(theme, 'config')
    const file = path.join(configDir, 'components.json')
    try {
      fsEx.ensureDirSync(configDir)
      fsEx.writeJSONSync(file, components, {spaces: 2})
    } catch (e) {
      logger.warn(`writing "${file}" failed (${e.message})`)
    }
  })
}

module.exports = {
  resetProject,
  setProcessFile,
  previousProcess,
  deleteProcessFile,
  getDirectories,
  getFiles,
  getApplicationFolder,
  generateComponentsJson
}
