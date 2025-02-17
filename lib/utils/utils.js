const logger = require('../logger')
const validator = require('@shopgate/extension-config-validator/validator.js')
const fsEx = require('fs-extra')
const path = require('path')
const os = require('os')
const { SETTINGS_FOLDER, EXTENSIONS_FOLDER, THEMES_FOLDER, TRUSTED_PIPELINES_FOLDER, PIPELINES_FOLDER } = require('../app/Constants')

async function filterDir (dirPath, filterFunction) {
  if (!await fsEx.pathExists(dirPath)) {
    logger.debug(`directory ${dirPath} does not exist`)
    return []
  }

  const listOfEntries = await fsEx.readdir(dirPath)
  const promises = listOfEntries
    .map(name => path.join(dirPath, name))
    .map((entry) => filterFunction(entry))
  const results = await Promise.all(promises)

  return listOfEntries.filter((entry, index) => {
    return results[index]
  })
}

/**
 * Returns all the sub dirs of a directory
 * @param {string} dirPath
 */
async function getDirectories (dirPath) {
  return filterDir(dirPath, async (entry) => {
    const basename = path.basename(entry)
    const stat = await fsEx.lstat(entry)
    return stat.isDirectory() && !basename.startsWith('.')
  })
}

/**
 * Filters all files of a directory optional by fileEnding
 * @param {string} dirPath
 * @param {string} [fileEnding]
 */
async function getFiles (dirPath, fileEnding) {
  return filterDir(dirPath, async file => {
    if (!(await fsEx.lstat(file)).isFile()) return false
    if (fileEnding) return file.endsWith(fileEnding)
    return true
  })
}

/**
 * Removes a file if it exists
 * @param {*} path
 */
async function removeIfExists (path) {
  if (await fsEx.pathExists(path)) {
    await fsEx.remove(path)
  } else {
    logger.debug(`file: ${path} does not exist`)
  }
}

/**
 * Resets the current project
 */
async function resetProject () {
  let appPath
  try {
    appPath = await getApplicationFolder()
  } catch (err) {
    return // couldn't locate app folder, we're probably in an empty folder
  }

  await Promise.all([
    removeIfExists(path.join(appPath, SETTINGS_FOLDER, 'app.json')),
    removeIfExists(path.join(appPath, SETTINGS_FOLDER, 'storage.json')),
    removeIfExists(path.join(appPath, SETTINGS_FOLDER, 'attachedExtensions.json'))
  ])

  const extensionsDir = path.join(appPath, EXTENSIONS_FOLDER)
  const extensionDirs = await getDirectories(extensionsDir)
  await Promise.all(extensionDirs.map(async extensionDir => removeIfExists(path.join(extensionsDir, extensionDir, 'extension', 'config.json'))))

  const themesDir = path.join(appPath, THEMES_FOLDER)
  const themeDirs = await getDirectories(themesDir)
  await Promise.all(themeDirs.map(async themeDir => removeIfExists(path.join(themesDir, themeDir, 'config', 'app.json'))))
  await Promise.all(themeDirs.map(async themeDir => removeIfExists(path.join(themesDir, themeDir, 'config', 'components.json'))))

  await fsEx.emptyDir(path.join(appPath, PIPELINES_FOLDER))
  await fsEx.emptyDir(path.join(appPath, TRUSTED_PIPELINES_FOLDER))
}

async function validateExtensionConfigs (appSettings) {
  const attachedExtensions = await appSettings.loadAttachedExtensions()
  const extensionsFolder = path.join(appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
  for (let extensionId in attachedExtensions) {
    const extensionPath = path.join(extensionsFolder, attachedExtensions[extensionId].path)
      /** @type {Internal.ExtensionConfigJson} */
    const configJson = await fsEx.readJson(path.join(extensionPath, 'extension-config.json'))
      /** @type {Internal.ExtensionConfig} */
    const config = { file: configJson, path: extensionPath }
    try {
      await validateExtensionConfig(config)
    } catch (err) {
      throw new Error(`Could not validate extension-config for ${extensionId}: ${err.message}`)
    }
  }
}
/**
 * @param {Internal.AppSettings} appSettings
 * @param {Internal.DcHttpClient} dcHttpClient
 */
async function writeExtensionConfigs (appSettings, dcHttpClient) {
  const appId = await appSettings.getId()
  const attachedExtensions = await appSettings.loadAttachedExtensions()
  const extensionsFolder = path.join(appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
  const promises = []
  for (let extensionId in attachedExtensions) {
    const extensionPath = path.join(extensionsFolder, attachedExtensions[extensionId].path)
      /** @type {Internal.ExtensionConfigJson} */
    const configJson = await fsEx.readJson(path.join(extensionPath, 'extension-config.json'))
      /** @type {Internal.ExtensionConfig} */
    const config = { file: configJson, path: extensionPath }
    promises.push(updateExtensionConfig(config, appId, dcHttpClient))
  }
  return Promise.all(promises)
}

/**
 *
 * @param {*} appSettings
 * @param {DcHttpClient} dcHttpClient
 */
async function pushHooks (appSettings, dcHttpClient) {
  const appId = await appSettings.getId()
  await dcHttpClient.clearHooks(appId)

  const attachedExtensions = await appSettings.loadAttachedExtensions()
  const extensionsFolder = path.join(appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
  const promises = []
  for (let extensionId in attachedExtensions) {
    const extensionPath = path.join(extensionsFolder, attachedExtensions[extensionId].path)
      /** @type {Internal.ExtensionConfigJson} */
    const configJson = await fsEx.readJson(path.join(extensionPath, 'extension-config.json'))
    promises.push(dcHttpClient.pushHooks(configJson, appId))
  }
  return Promise.all(promises)
}

/**
 * @param {string} processName
 * @param {int} pid
 * @param {string} dir
 */
async function setProcessFile (processName, dir, pid) {
  await fsEx.writeJson(path.join(dir, processName), { pid })
}

/**
 * @param {string} processName
 * @param {string} dir
 */
async function deleteProcessFile (processName, dir) {
  await fsEx.remove(path.join(dir, processName))
}

/**
 * @param {Internal.ExtensionConfig} config
 * @param {string} appId
 * @param {Internal.DcHttpClient} dcHttpClient
 */
async function updateExtensionConfig (config, appId, dcHttpClient) {
  try {
    const blacklistedExtensions = getBlacklistedExtensions()
    if (blacklistedExtensions.includes(config.file.id)) return logger.info(`Ignoring extension-config.json of ${config.file.id} (blacklisted)`)

    const extConfig = await dcHttpClient.generateExtensionConfig(config.file, appId)
    const backendConfig = extConfig.backend || {}
    const frontendConfig = extConfig.frontend || {}

    const backendPath = path.join(config.path, 'extension')
    const frontendPath = path.join(config.path, 'frontend')

    if (await fsEx.pathExists(backendPath)) {
      await fsEx.outputJson(path.join(backendPath, 'config.json'), backendConfig, { spaces: 2 })
      logger.info(`Updated extension config for backend ${config.file.id}`)
    }

    if (await fsEx.pathExists(frontendPath)) {
      await fsEx.outputJson(path.join(frontendPath, 'config.json'), frontendConfig, { spaces: 2 })
      logger.info(`Updated extension config for frontend ${config.file.id}`)
    }
  } catch (err) {
    logger.error(`'${config.file.id}': ${err.message}`)
  }
}

/**
 * Returns pid of previous process or null
 * @param {string} processName
 * @param {string} dir
 */
async function getProcessId (processName, dir) {
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

async function getApplicationFolder () {
  if (process.env.APP_PATH) return process.env.APP_PATH

  try {
    return findRoot(process.cwd(), async (dir) => fsEx.exists(path.join(dir, '.sgcloud', 'app.json')))
  } catch (err) {
    // NOTE: workaround, find root would print "package.json not found in path"
    err.message = 'Couldn\'t find application folder upwards'
    logger.debug(err)
  }

  return process.cwd()
}

async function findRoot (start, check) {
  start = start || module.parent.filename

  if (typeof start === 'string') {
    if (start[start.length - 1] !== path.sep) {
      start += path.sep
    }
    start = start.split(path.sep)
  }
  if (!start.length) {
    throw new Error('package.json not found in path')
  }
  start.pop()
  const dir = start.join(path.sep)
  try {
    if (await check(dir)) {
      return dir
    }
  } catch (e) { }
  return findRoot(start, check)
}

/**
 * @param {AppSettings} appSettings
 */
async function generateComponentsJson (appSettings) {
  const attachedExtensions = await appSettings.loadAttachedExtensions()
  const appFolder = appSettings.getApplicationFolder()
  const extensionsFolder = path.join(appFolder, EXTENSIONS_FOLDER)

  const components = {}
  for (let extensionId in attachedExtensions) {
    const extensionPath = path.join(extensionsFolder, attachedExtensions[extensionId].path)

    const config = await fsEx.readJson(path.join(extensionPath, 'extension-config.json'))

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

  const themes = await getDirectories(path.join(appFolder, THEMES_FOLDER))

  if (!themes.length) return Promise.resolve()

  logger.info(`Generating components.json for ${themes}`)

  // write components.json for each theme
  return Promise.all(themes.map(async theme => {
    theme = path.join(appFolder, THEMES_FOLDER, theme)

    if (!await fsEx.exists(path.join(theme, 'extension-config.json'))) return
    const configDir = path.join(theme, 'config')
    const file = path.join(configDir, 'components.json')
    try {
      await fsEx.ensureDir(configDir)
      await fsEx.writeJSON(file, components, { spaces: 2 })
    } catch (e) {
      logger.warn(`writing "${file}" failed (${e.message})`)
    }
  }))
}

/**
 * Find all themes inside the project.
 * @returns {Array}
 */
async function findThemes (appSettings) {
  // Absolute path to the themes.
  const source = path.resolve(appSettings.getApplicationFolder(), THEMES_FOLDER)

  // Get all folders inside the themes directory.
  const folders = await fsEx.readdir(source)

  const promises = folders.map(async folder => {
    const dirObj = await fsEx.lstat(path.join(source, folder))

    const isDir = dirObj.isDirectory()
    if (!isDir) return false

    const extensionConfigExists = await fsEx.exists(path.join(source, folder, 'extension-config.json'))
    return extensionConfigExists
  })

  const results = await Promise.all(promises)

  const filteredFolders = folders.filter((folder, index) => results[index])

  return filteredFolders
}

function getBlacklistedExtensions () {
  const csvList = process.env.IGNORE_EXT_CONFIG_FOR
  if (!csvList) return []

  const list = csvList.split(',')
  logger.debug(`Extension config blacklist: ${list}`)
  return list
}

async function validateExtensionConfig (file) {
  await validator.validate(path.join(file.path, 'extension-config.json'))
  await validator.validateComponentsPaths(path.join(file.path, 'extension-config.json'))
}

async function writeLocalPipelines (appSettings, dcHttpClient, appId, pipelinesFolder, trustedPipelinesFolder) {
  logger.info('Processing pipelines...')

  const attachedExtensions = Object.keys(await appSettings.loadAttachedExtensions())

  await Promise.all([
    _getAndSavePipelines(dcHttpClient, appId, false, false, pipelinesFolder, attachedExtensions),
    _getAndSavePipelines(dcHttpClient, appId, true, false, trustedPipelinesFolder, attachedExtensions)
  ])
  await Promise.all([
    _getAndSavePipelines(dcHttpClient, appId, false, true, path.join(pipelinesFolder, 'resolved'), attachedExtensions),
    _getAndSavePipelines(dcHttpClient, appId, true, true, path.join(trustedPipelinesFolder, 'resolved'), attachedExtensions)
  ])
  logger.info('Processing pipelines... done')
}

/**
 * @param {DcHttpClient} dcHttpClient
 * @param {string} appId
 * @param {Boolean} trusted
 * @param {Boolean} resolved
 * @param {string} destination
 */
async function _getAndSavePipelines (dcHttpClient, appId, trusted, resolved, destination, attached) {
  const response = await dcHttpClient.downloadPipelines(appId, trusted, resolved, attached)
  if (response.warnings && response.warnings.length > 0) {
    response.warnings.forEach(warn => logger.warn(warn))
  }
  return _writePipelines(response.pipelines, destination)
}

/**
 * @param {string[]} pipelines
 * @param {string} folder
 */
async function _writePipelines (pipelines, folder) {
  await fsEx.ensureDir(folder)
  await fsEx.emptyDir(folder)
  return Promise.all(pipelines.map(async (pipeline) => {
    const file = path.join(folder, `${pipeline.pipeline.id}.json`)
    await fsEx.writeJson(file, pipeline, { spaces: 2 })
  }))
}

async function sleep (sleepTime = 1) {
  await new Promise((resolve) => setTimeout(resolve, sleepTime))
}

async function runSpinner (message, fn) {
  const spinnerFrames = ['.', '..', '...', '']
  const stream = process.stdout
  let spinnerInterval
  let result

  if (stream.isTTY) {
    stream.write('\u001b[?25l')

    let spinnerFrame = 0
    spinnerInterval = setInterval(() => {
      stream.clearLine()
      stream.cursorTo(0)
      stream.write(`${message} ${spinnerFrames[spinnerFrame]}`)
      spinnerFrame = ++spinnerFrame % spinnerFrames.length
    }, 400)
  }

  try {
    // Let us return the result of fn
    result = await fn()
  } finally {
    if (stream.isTTY) {
      spinnerInterval && clearInterval(spinnerInterval)
      stream.clearLine()
      stream.cursorTo(0)
      stream.write('\u001b[?25h')
    }
  }

  stream.write(`${message}\n`)

  return result
}

function getExtensionDirectoryName (extensionId = '') {
  return extensionId.replace(/\//g, '-')
}

/**
 * Returns the client's local IP address.
 * @return {string}
 */
function getLocalIpAddress () {
  // Resolve the local area network ip.
  const ifaces = os.networkInterfaces()
  let localIp = (Object.values(ifaces)
    .reduce((acc, val) => acc.concat(val), [])
    // Take the first IPv4 address that is not internal (e.g. loopback device).
    .find(iface => iface.family === 'IPv4' && !iface.internal) || {}).address || '127.0.0.1'

  return localIp
}

/**
 * Returns a list of all local IP v4 addresses.
 * @returns {Array<{address: string, mac: string, interface: string}>}
 */
function getLocalIpAddresses () {
  const ifaces = os.networkInterfaces()

  return Object.keys(ifaces).reduce((acc, ifaceName) => {
    const addresses = ifaces[ifaceName]
      .filter(({ family, internal }) => {
        return family === 'IPv4' && !internal
      })
      .map(({ address, mac }) => {
        return { address, mac, iface: ifaceName }
      })

    return acc.concat(addresses)
  }, [])
}

module.exports = {
  resetProject,
  setProcessFile,
  getProcessId,
  deleteProcessFile,
  getDirectories,
  getFiles,
  getApplicationFolder,
  generateComponentsJson,
  findThemes,
  getBlacklistedExtensions,
  updateExtensionConfig,
  writeExtensionConfigs,
  validateExtensionConfig,
  validateExtensionConfigs,
  pushHooks,
  writeLocalPipelines,
  sleep,
  runSpinner,
  getExtensionDirectoryName,
  getLocalIpAddress,
  getLocalIpAddresses
}
