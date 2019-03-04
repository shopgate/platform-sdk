const os = require('os')
const path = require('path')
const fsEx = require('fs-extra')
const inquirer = require('inquirer')
const request = require('request')
const unzip = require('unzip')
const replace = require('replace-in-file')
const childProcess = require('child_process')
const tar = require('tar-fs')
const zlib = require('zlib')
const parseGitignore = require('parse-gitignore')
const micromatch = require('micromatch')
const extensionConfigValidator = require('@shopgate/extension-config-validator')
const { NotFoundError, ConflictError, SoftError } = require('../errors')
const logger = require('../logger')
const utils = require('../utils/utils')
const exceptionHandler = require('../utils/exceptionHandler')
const t = require('../i18n')(__filename)

const DEFAULT_NAME = 'cloud-sdk-boilerplate-extension-master'
const EXTENSION_NAME_REGEX = /^@[A-Za-z][A-Za-z0-9-_]{0,213}\/[A-Za-z][A-Za-z0-9-_]{0,213}$/

const { EXTENSIONS_FOLDER, THEMES_FOLDER } = require('../app/Constants')

class ExtensionAction {
  static build (appSettings, userSettings, dcHttpClient) {
    return new ExtensionAction(appSettings, userSettings, dcHttpClient)
  }

  /**
   * @param {Command} caporal
   * @param {AppSettings} appSettings
   * @param {UserSettings} userSettings
   */
  static register (caporal, appSettings, userSettings, dcHttpClient) {
    caporal
      .command('extension create')
      .description(t('CREATE_DESCRIPTION'))
      .argument('[types...]', t('CREATE_TYPES_DESCRIPTION'))
      .option('--extension [extensionName]', t('CREATE_EXTENSION_DESCRTIPTION'))
      .option('--trusted [type]', t('CREATE_TRUSTED_DESCRIPTION'))
      .action(async (args, options) => {
        await ExtensionAction.build(appSettings, userSettings).createExtension(args, options).catch(exceptionHandler)
      })

    caporal
      .command('extension attach')
      .argument('[extensions...]', t('ATTACH_EXTENSIONS_DESCRIPTION'))
      .description(t('ATTACH_DESCRIPTION'))
      .action(async (args) => {
        await ExtensionAction.build(appSettings, userSettings).attachExtensions(args).catch(exceptionHandler)
      })

    caporal
      .command('extension detach')
      .argument('[extensions...]', t('DETACH_EXTENSIONS_DESCRIPTION'))
      .description(t('DETACH_DESCRIPTION'))
      .action(async (args) => {
        await ExtensionAction.build(appSettings, userSettings).detachExtensions(args).catch(exceptionHandler)
      })

    caporal
      .command('extension manage')
      .description(t('MANAGE_DESCRIPTION'))
      .action(async () => {
        await ExtensionAction.build(appSettings, userSettings).manageExtensions().catch(exceptionHandler)
      })

    caporal
      .command('extension upload')
      .description(t('EXT_UPLOAD_DESCRIPTION'))
      .argument('[extension]', t('EXT_UPLOAD_EXTENSION_DESCRIPTION'))
      .option('-f, --force', t('EXT_UPLOAD_FORCE_DESCRIPTION'))
      .option('-t, --preprocess-timeout <ms>', t('EXT_UPLOAD_PREPROCESS_TIMEOUT_DESCRIPTION'), caporal.INT, 60e4)
      .option('-i, --poll-interval <ms>', t('EXT_UPLOAD_POLL_INTERVAL_DESCRIPTION'), caporal.INT, 3000)
      .action(async (args, options) => {
        await ExtensionAction.build(appSettings, userSettings, dcHttpClient).uploadExtension(args, options).catch(exceptionHandler)
      })

    caporal
      .command('theme upload')
      .description(t('THEME_UPLOAD_DESCRIPTION'))
      .argument('[theme]', t('THEME_UPLOAD_EXTENSION_DESCRIPTION'))
      .option('-f, --force', t('THEME_UPLOAD_FORCE_DESCRIPTION'))
      .option('-t, --preprocess-timeout <ms>', t('THEME_UPLOAD_PREPROCESS_TIMEOUT_DESCRIPTION'), caporal.INT, 60e4)
      .option('-i, --poll-interval <ms>', t('THEME_UPLOAD_POLL_INTERVAL_DESCRIPTION'), caporal.INT, 3000)
      .action(async (args = {}, options = {}) => {
        options._isTheme = true
        args.extension = args.theme
        delete args.theme
        await ExtensionAction.build(appSettings, userSettings, dcHttpClient).uploadExtension(args, options).catch(exceptionHandler)
      })
  }

  /**
   * @param {AppSettings} appSettings
   * @param {UserSettings} userSettings
   */
  constructor (appSettings, userSettings, dcHttpClient) {
    this.appSettings = appSettings
    this.userSettings = userSettings
    this.dcHttpClient = dcHttpClient
  }

  /**
   * @param {object} options
   * @param {string[]} types
   * @param {object} externalUserInput
   */
  _getUserInput (options, types = [], externalUserInput) {
    let trusted
    if (typeof options.trusted === 'boolean') trusted = options.trusted

    const userInput = {
      extensionName: options.extension,
      trusted,
      toBeCreated: {
        frontend: types.includes('frontend'),
        backend: types.includes('backend')
      }
    }

    const questions = []

    if (!userInput.toBeCreated.frontend && !userInput.toBeCreated.backend) {
      questions.push({
        name: 'types',
        message: t('INPUT_EXTENSION_TYPE'),
        type: 'checkbox',
        validate: (input) => {
          if (input.length === 0) return t('INVALID_EXTENSION_TYPE')
          return true
        },
        default: ['backend', 'frontend'],
        choices: ['backend', 'frontend']
      })
    }

    if (!userInput.extensionName || !EXTENSION_NAME_REGEX.test(userInput.extensionName)) {
      questions.push({
        name: 'extensionName',
        message: t('INPUT_EXTENSION_NAME'),
        validate: (input) => {
          const valid = /^@[A-Za-z][A-Za-z0-9-_]{0,213}\/[A-Za-z][A-Za-z0-9-_]{0,213}$/.test(input)
          if (!valid) return t('INVALID_EXTENSION_NAME')
          return true
        },
        when: (answers) => {
          // Consider it unnecessary if there isn't a type neigher in answers.types nor types
          return (answers.types && answers.types.length) > 0 || types.length > 0
        }
      })
    }

    if (userInput.trusted === undefined) {
      questions.push({
        name: 'trusted',
        message: t('INPUT_EXTENSION_TRUSTED'),
        type: 'list',
        choices: ['yes', 'no'],
        default: 'no',
        when: (answers) => {
          // Consider unnecessary if there isn't a type or its only frontend
          return (answers.types && answers.types.includes('backend')) || types.includes('backend')
        }
      })
    }

    return new Promise((resolve, reject) => {
      if (questions.length > 0) {
        return inquirer.prompt(questions).then((answers) => {
          if (answers.extensionName) userInput.extensionName = answers.extensionName
          if (answers.types && answers.types.includes('frontend')) userInput.toBeCreated.frontend = true
          if (answers.types && answers.types.includes('backend')) userInput.toBeCreated.backend = true
          if (answers.trusted) userInput.trusted = answers.trusted === 'yes'
          if (userInput.toBeCreated.backend === false && userInput.toBeCreated.frontend === false) throw new Error(t('ERROR_NO_EXTENSION_TYPE'))
          Object.assign(externalUserInput, userInput)
          resolve()
        }).catch(err => reject(err))
      }

      Object.assign(externalUserInput, userInput)
      resolve()
    })
      .then(() => {
        externalUserInput.organizationName = userInput.extensionName.split('/')[0].replace('@', '')
      })
  }

  /**
   * @param {string} extensionsFolder
   * @param {object} state
   */
  _downloadBoilerplate (extensionsFolder, state) {
    logger.debug(t('DOWNLOADING_BOILERPLATE'))

    return new Promise((resolve, reject) => {
      const extractor = unzip.Extract({ path: `${extensionsFolder}/${DEFAULT_NAME}` })
      extractor.on('close', () => {
        logger.debug(t('DOWNLOADING_BOILERPLATE_DONE'))
        state.cloned = true
        resolve()
      })
      extractor.on('error', (err) => {
        if (process.env['LOG_LEVEL'] === 'debug') logger.error(err)
        reject(new Error(t('ERROR_DOWNLOADING_BOILERPLATE', err)))
      })
      request(this.getBoilerplateUrl()).pipe(extractor)
    })
  }

  getBoilerplateUrl () {
    if (process.env['BOILERPLATE_URL']) return process.env['BOILERPLATE_URL']
    if (process.env['SDK_BETA'] === 'true') return 'https://data.shopgate.com/connect/platform-sdk/beta.zip'
    return 'https://data.shopgate.com/connect/platform-sdk/latest.zip'
  }

  /**
   * @param {object} userInput
   * @param {string} defaultPath
   * @param {string} extensionsFolder
   * @param {object} state
   */
  _renameBoilerplate (userInput, defaultPath, extensionsFolder, state) {
    logger.debug(t('RENAMING_BOILERPLATE'))
    const ePath = path.join(extensionsFolder, utils.getExtensionDirectoryName(userInput.extensionName))
    return new Promise((resolve, reject) => {
      fsEx.rename(defaultPath, ePath, (err) => {
        if (err) {
          if (process.env['LOG_LEVEL'] === 'debug') logger.error(err)
          return reject(new Error(t('ERROR_RENAMING_BOILERPLATE', err)))
        }
        state.extensionPath = ePath
        state.moved = true
        logger.debug(t('RENAMING_BOILERPLATE_DONE'))
        resolve()
      })
    })
  }

  /**
   * @param {object} userInput
   * @param {object} state
   */
  _removeUnusedDirs (userInput, state) {
    const promises = []

    if (!userInput.toBeCreated.frontend) promises.push(fsEx.remove(path.join(state.extensionPath, 'frontend')))
    if (!userInput.toBeCreated.backend) {
      promises.push(fsEx.remove(path.join(state.extensionPath, 'extension')))
      promises.push(fsEx.remove(path.join(state.extensionPath, 'pipelines')))
    }

    if (promises.length > 0) logger.debug(t('REMOVING_UNUSED_DIRS'))

    return Promise.all(promises).then(logger.debug(t('REMOVING_UNUSED_DIRS_DONE')))
  }

  /**
   * @param {object} userInput
   * @param {object} state
   */
  _removePlaceholders (userInput, state) {
    logger.debug(t('REMOVING_PLACEHOLDERS', { extensionPath: state.extensionPath }))
    return replace({
      files: [
        `${state.extensionPath}/**/*.json`,
        `${state.extensionPath}/*.json`
      ],
      from: [
        /@awesomeOrganization\/awesomeExtension/g,
        /awesomeOrganization/g
      ],
      to: [
        userInput.extensionName,
        userInput.organizationName
      ]
    })
      .then((changes) => logger.debug(t('REMOVING_PLACEHOLDERS_DONE')))
      .catch(err => {
        // Because replace fails if no files match the pattern ...
        if (err.message.startsWith('No files match the pattern')) return logger.debug(t('ERROR_NO_FILES_MATCH_PATTERN'))
      })
  }

  /**
   * @param {object} userInput
   * @param {object} state
   */
  _updateBackendFiles (userInput, state) {
    if (!userInput.toBeCreated.backend) return

    logger.debug(t('UPDATING_BACKEND_FILES'))

    const promises = []
    // Rename default pipeline
    const pipelineDirPath = path.join(state.extensionPath, 'pipelines')
    promises.push(fsEx.move(path.join(pipelineDirPath, 'awesomeOrganization.awesomePipeline.v1.json'), path.join(pipelineDirPath, `${userInput.organizationName}.awesomePipeline.v1.json`)))

    // Add trusted if necessary
    if (userInput.trusted) {
      const exConfPath = path.join(state.extensionPath, 'extension-config.json')

      const p = fsEx.readJSON(exConfPath)
        .then((exConf) => {
          exConf.trusted = userInput.trusted
          return fsEx.writeJson(exConfPath, exConf, { spaces: 2 })
        })

      promises.push(p)
    }

    return Promise.all(promises).then(logger.debug(t('UPDATING_BACKEND_FILES_DONE')))
  }

  /**
   * @param {object} userInput
   * @param {object} state
   * @param {object=} command
   */
  _installFrontendDependencies (userInput, state, command) {
    if (!userInput.toBeCreated.frontend) return
    command = command || { command: /^win/.test(process.platform) ? 'npm.cmd' : 'npm', params: ['i'] }

    const frontendPath = path.join(state.extensionPath, 'frontend')

    let stdioMode = 'inherit'
    if (process.env.INTEGRATION_TEST === 'true') {
      stdioMode = 'ignore'
    }

    return new Promise((resolve, reject) => {
      logger.info(t('INSTALLING_FRONTEND_DEPENDENCIES'))
      const installProcess = childProcess.spawn(command.command, command.params, {
        env: process.env,
        cwd: frontendPath,
        stdio: stdioMode
      })
      installProcess.on('exit', (code, signal) => {
        if (code === 0) return resolve()
        reject(new Error(t('ERROR_INSTALLING_FRONTEND_DEPENDENCIES', { code, signal })))
      })
    })
  }

  async _cleanUp (state, defaultPath) {
    if (state.cloned) await fsEx.remove(state.moved ? state.extensionPath : defaultPath)
  }

  /**
   * @param {string[]} types
   * @param {object} options
   */
  async createExtension ({ types }, options) {
    await this.userSettings.validate()
    await this.appSettings.validate()

    const userInput = {}
    let state = {
      cloned: false,
      moved: false,
      extensionPath: null
    }

    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    const defaultPath = path.join(extensionsFolder, DEFAULT_NAME)

    try {
      await this._getUserInput(options, types, userInput)
      await this._checkIfExtensionExists(userInput.extensionName)
      await this._downloadBoilerplate(extensionsFolder, state)
      await this._renameBoilerplate(userInput, defaultPath, extensionsFolder, state)
      await this._removeUnusedDirs(userInput, state)
      await this._removePlaceholders(userInput, state)
      await this._updateBackendFiles(userInput, state)
      await this._installFrontendDependencies(userInput, state)
      logger.info(t('EXTENSION_CREATED_SUCCESSFULLY', userInput))
      const extensionFolderName = utils.getExtensionDirectoryName(userInput.extensionName)
      const extensionInfo = await this._getExtensionInfo(extensionFolderName)
      await this.appSettings.attachExtension(extensionFolderName, { id: extensionInfo.id, trusted: userInput.trusted }, true)
      await utils.generateComponentsJson(this.appSettings)
    } catch (err) {
      logger.error(t('ERROR_CREATE_EXTENSION', {err}))
      await this._cleanUp(state, defaultPath)
    }
  }

  /**
   * @param {String[]} A list of extension folder names (path, relative to the "extensions" folder).
   */
  async attachExtensions ({ extensions = [] }) {
    await this.userSettings.validate()
    await this.appSettings.validate()

    let force = false
    if (!extensions.length) {
      extensions = await this._getAllExtensions()
      force = true
    }

    const extensionInfo = await Promise.all(extensions.map(extensionFolderName => this._getExtensionInfo(extensionFolderName, true)))

    const proccessedExtensions = extensions
      .reduce((processedExtensions, extensionFolderName, index) => {
        if (!extensionInfo[index]) {
          logger.warn(t('NO_EXTENSION_IN_DIRECTORY', { directory: extensionFolderName }))
        } else {
          processedExtensions.push({ extensionFolderName, extensionInfo: extensionInfo[index] })
        }

        return processedExtensions
      }, [])

    while (proccessedExtensions.length > 0) {
      const processedExtension = proccessedExtensions.pop()
      await this.appSettings.attachExtension(
        processedExtension.extensionFolderName,
        {
          id: processedExtension.extensionInfo.id,
          trusted: processedExtension.extensionInfo.trusted
        },
        force
      )
    }
    return utils.generateComponentsJson(this.appSettings)
  }

  /**
   * @param {String[]} A list of extension folder names (path, relative to the "extensions" folder).
   */
  async detachExtensions ({ extensions = [] }) {
    await this.userSettings.validate()
    await this.appSettings.validate()

    if (!extensions.length) {
      await this.appSettings.detachAllExtensions()
      return
    }

    const extensionInfo = await Promise.all(extensions.map(extensionFolderName => this._getExtensionInfo(extensionFolderName, true)))

    const processedExtensions = extensions
      .reduce((processedExtensions, extensionFolderName, index) => {
        if (!extensionInfo[index]) {
          logger.warn(t('NO_EXTENSION_IN_DIRECTORY', { directory: extensionFolderName }))
        } else {
          processedExtensions.push({ extensionFolderName, extensionInfo: extensionInfo[index] })
        }

        return processedExtensions
      }, [])

    for (const processedExtension of processedExtensions) {
      await this.appSettings.detachExtension(processedExtension.extensionInfo.id)
    }
  }

  /**
   * @returns {Promise}
   */
  async manageExtensions () {
    await this.userSettings.validate()
    await this.appSettings.validate()

    // Get the extension properties and sort the entries alphabetically for better readability within the picker
    // const extensionsSummary = await this._getExtensionsSummary().sort((a, b) => a.id.localeCompare(b.id))
    const extensionProperties = await this._getAllExtensionProperties()

    if (extensionProperties.length === 0) {
      return logger.warn(t('NO_EXTENSIONS_IN_DIRECTORY', { directory: `.${path.sep}${EXTENSIONS_FOLDER}` }))
    }

    const choices = extensionProperties
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      .map(({ id, attached }) => ({
        name: id,
        checked: attached
      }))

    if (choices.length > 10) {
      choices.push(new inquirer.Separator())
    }

    const selected = (await inquirer.prompt({
      type: 'checkbox',
      name: 'extensions',
      message: t('INPUT_EXTENSIONS_TO_ATTACH'),
      pageSize: 10,
      choices
    })).extensions.map((selectedId) => {
      // Collect the dirnames of the selected extensions
      return extensionProperties.find(({ id }) => id === selectedId).dir
    })

    // Create dirname lists of the available extensions since they are needed later to attach in detach
    const attached = extensionProperties.filter(({ attached }) => attached).map(({ dir }) => dir)
    const detached = extensionProperties.filter(({ attached }) => !attached).map(({ dir }) => dir)

    const toBeAttached = selected.filter(entry => detached.includes(entry))
    const toBeDetached = attached.filter(entry => !selected.includes(entry))

    const attachedExtensions = await this.appSettings.loadAttachedExtensions()
    const goneExtensions = Object.keys(attachedExtensions)
      .filter((extensionId) => !extensionProperties.find(({ id }) => id === extensionId))

    for (let i = 0, l = goneExtensions.length; i < l; i++) {
      await this.appSettings.detachExtension(goneExtensions[i])
    }

    if (toBeDetached.length) await this.detachExtensions({ extensions: toBeDetached })
    if (toBeAttached.length) await this.attachExtensions({ extensions: toBeAttached })
  }

  /**
   * @param {Object} args
   * @param {String} [args.extension] Target extension folder name
   * @param {Object} options
   * @param {Number} [options.preprocessTimeout] Number of milliseconds to wait for preprocessing to complete
   * @param {Boolean} [options.force] Forces creation of version without asking user
   * @returns {Promise}
   */
  async uploadExtension (args = {}, options = {}) {
    await this.userSettings.validate()
    await this.appSettings.validate()

    const isTheme = options._isTheme === true
    const {
      extensionId,
      extensionDir,
      extensionVersion
    } = await this._resolveExtensionInfo(args.extension, isTheme)

    const extensionIdVersion = `${extensionId}@${extensionVersion}`
    const extensionsDirectory = isTheme
      ? path.join(this.appSettings.getApplicationFolder(), THEMES_FOLDER)
      : path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    const extensionPath = path.resolve(extensionsDirectory, extensionDir)
    const extensionConfigPath = path.resolve(extensionPath, 'extension-config.json')
    try {
      await extensionConfigValidator.validate(extensionConfigPath)
    } catch (err) {
      const currentDir = process.cwd()
      let relativeExtensionsConfigPath

      if (extensionConfigPath.startsWith(currentDir)) {
        relativeExtensionsConfigPath = path.relative(currentDir, extensionConfigPath)
        relativeExtensionsConfigPath = `${path.sep}${relativeExtensionsConfigPath}`
      } else {
        relativeExtensionsConfigPath = extensionConfigPath.replace(new RegExp(`^${currentDir}`), '')
      }
      throw new Error(t('ERROR_CONFIG_VALIDATION_FAILED', { configPath: relativeExtensionsConfigPath, message: err.message }))
    }

    const archivePath = await utils.runSpinner(t('PACKING_EXTENSION_VERSION', { extensionVersion: extensionIdVersion }), () => this._packExtension(extensionPath))
    logger.debug(t('PACKED_EXTENSION_VERSION', { extensionVersion: extensionIdVersion, archivePath }))

    try {
      await utils.runSpinner(t('UPLOADING_EXTENSION_VERSION', { extensionVersion: extensionIdVersion }), () =>
        this.dcHttpClient.uploadExtensionFile(extensionId, extensionVersion, archivePath, {
          forceVersionCreate: options.force,
          cancelReview: options.force
        })
      )
    } catch (err) {
      if (err instanceof NotFoundError && err.message.toLowerCase() === 'version not found' && !options.force) {
        const { createVersion } = await inquirer.prompt({
          type: 'confirm',
          name: 'createVersion',
          message: t('INPUT_AUTO_CREATE_VERSION', { extensionVersion }),
          default: true
        })

        if (createVersion) {
          await utils.runSpinner(t('UPLOADING_EXTENSION_VERSION', { extensionVersion: extensionIdVersion }), () =>
            this.dcHttpClient.uploadExtensionFile(extensionId, extensionVersion, archivePath, { forceVersionCreate: true })
          )
        } else {
          throw new Error(t('ERROR_EXTENSION_VERSION_NOT_CREATED', { extensionVersion }))
        }
      } else if (err instanceof ConflictError && err.data && err.data.code === 'WAITING_FOR_REVIEW' && !options.force) {
        const { cancelReview } = await inquirer.prompt({
          type: 'confirm',
          name: 'cancelReview',
          message: t('INPUT_CANCEL_EXTENSION_VERSION_REVIEW', { extensionVersion }),
          default: true
        })

        if (cancelReview) {
          await utils.runSpinner(t('UPLOADING_EXTENSION_VERSION', { extensionVersion: extensionIdVersion }), () =>
            this.dcHttpClient.uploadExtensionFile(extensionId, extensionVersion, archivePath, { cancelReview: true })
          )
        } else {
          throw new SoftError(t('ERROR_EXTENSION_VERSION_WAITING_REVIEW'))
        }
      } else if (err instanceof NotFoundError && err.message.toLowerCase() === 'extension not found') {
        throw new Error(isTheme ? t('ERROR_THEME_NOT_FOUND', { extensionId }) : t('ERROR_EXTENSION_NOT_FOUND', { extensionId }))
      } else {
        throw err
      }
    } finally {
      logger.debug(t('DELETING_ARCHIVE', { archivePath }))
      await fsEx.remove(path.dirname(archivePath))
    }
    logger.debug(t('UPLOADED_EXTENSION_VERSION', { extensionVersion: extensionIdVersion }))

    await utils.runSpinner(t('PREPROCESSING_EXTENSION_VERSION', { extensionVersion: extensionIdVersion }), () => {
      const { pollInterval, preprocessTimeout } = options
      return this._ensureExtensionVersionUploaded(extensionId, extensionVersion, { pollInterval, preprocessTimeout })
    })
    logger.debug(t('PREPROCESSING_FINISHED', { extensionVersion: extensionIdVersion }))

    logger.plain(isTheme ? t('THEME_UPLOADED_SUCCESSFULLY', { extensionVersion: extensionIdVersion }) : t('EXTENSION_UPLOADED_SUCCESSFULLY', { extensionVersion: extensionIdVersion }))
  }

  /**
   * @param {String} extensionDir
   * @param {Boolean} isTheme
   * @returns {Promise}
   */
  async _resolveExtensionInfo (extensionDir, isTheme = false) {
    const extensionsDirectory = isTheme
      ? path.join(this.appSettings.getApplicationFolder(), THEMES_FOLDER)
      : path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)

    const extensionInfo = {}

    if (extensionDir) {
      const extensionPath = path.resolve(extensionsDirectory, extensionDir)
      if (!(await fsEx.exists(extensionPath))) {
        throw new Error(isTheme ? t('ERROR_THEME_DIRECTORY_NOT_EXISTS', { extensionDir }) : t('ERROR_EXTENSION_DIRECTORY_NOT_EXISTS', { extensionDir }))
      }
    } else {
      let choices

      if (isTheme) {
        choices = await utils.findThemes(this.appSettings)
      } else {
        const extensionPropeties = await this._getAllExtensionProperties()
        choices = extensionPropeties.map(({ id, dir }) => ({ name: id, value: dir }))
      }

      if (choices.length === 0) {
        const currentDir = process.cwd()
        let relativeExtensionsDirectory

        if (extensionsDirectory.startsWith(currentDir)) {
          relativeExtensionsDirectory = path.relative(currentDir, extensionsDirectory)
          relativeExtensionsDirectory = `${path.sep}${relativeExtensionsDirectory}`
        } else {
          relativeExtensionsDirectory = extensionsDirectory.replace(new RegExp(`^${currentDir}`), '')
        }
        throw new Error(isTheme ? t('ERROR_NO_THEMES_IN_DIRECTORY', { directory: relativeExtensionsDirectory }) : t('ERROR_NO_EXTENSIONS_IN_DIRECTORY', { directory: relativeExtensionsDirectory }))
      }

      extensionDir = (await inquirer.prompt({
        type: 'list',
        name: 'extensionDir',
        message: isTheme ? t('INPUT_SELECT_THEME_TO_UPLOAD') : t('INPUT_SELECT_EXTENSION_TO_UPLOAD'),
        pageSize: 10,
        choices
      })).extensionDir
    }

    try {
      const extensionConfigPath = path.resolve(extensionsDirectory, extensionDir, 'extension-config.json')
      const currentDir = process.cwd()
      let relativeExtensionsConfigPath

      if (extensionConfigPath.startsWith(currentDir)) {
        relativeExtensionsConfigPath = path.relative(currentDir, extensionConfigPath)
        relativeExtensionsConfigPath = `${path.sep}${relativeExtensionsConfigPath}`
      } else {
        relativeExtensionsConfigPath = extensionConfigPath.replace(new RegExp(`^${currentDir}`), '')
      }
      const extensionConfig = await fsEx.readJSON(extensionConfigPath)

      let errorMessage
      if (!extensionConfig) {
        errorMessage = t('ERROR_INVALID_JSON_IN_CONFIG', { configPath: relativeExtensionsConfigPath })
      } else if (!extensionConfig.id) {
        errorMessage = t('ERROR_NO_ID_IN_CONFIG', { configPath: relativeExtensionsConfigPath })
      } else if (!extensionConfig.version) {
        errorMessage = t('ERROR_NO_VERSION_IN_CONFIG', { configPath: relativeExtensionsConfigPath })
      }

      if (errorMessage) throw new Error(errorMessage)

      extensionInfo.extensionId = extensionConfig.id
      extensionInfo.extensionDir = extensionDir
      extensionInfo.extensionVersion = extensionConfig.version
    } catch (err) {
      if (err.code === 'ENOENT') {
        err.message = t('ERROR_NO_CONFIG_IN_DIRECTORY', { directory: extensionDir })
      }
      throw err
    }

    return extensionInfo
  }

  /**
   * @param {String} extensionPath
   * @returns {Promise}
   */
  async _packExtension (extensionPath) {
    const tempDir = await fsEx.mkdtemp(`${os.tmpdir()}${path.sep}`)
    const archivePath = path.resolve(tempDir, `${path.basename(extensionPath)}.tar.gz`)

    logger.debug(t('BUILDING_EXCLUSION_LIST'))
    let ignorePatterns
    try {
      const gitignorePath = path.resolve(extensionPath, '.gitignore')
      const gitignoreContents = await fsEx.readFile(gitignorePath)
      ignorePatterns = parseGitignore(gitignoreContents)
    } catch (err) {
      logger.debug(t('NO_GITIGNORE_IN_DIRECTORY', { directory: extensionPath }))
      ignorePatterns = ['node_modules']
    }
    ignorePatterns.push('.git', '.gitignore')
    ignorePatterns = ignorePatterns.map(item => item.replace(/\/$/, ''))

    const tempFile = fsEx.createWriteStream(archivePath)
    const tarStream = tar.pack(extensionPath, {
      ignore (name) {
        const names = [ path.basename(name) ]
        return micromatch.some(names, ignorePatterns)
      }
    })

    logger.debug(t('PACKING_DIRECTORY', { directory: extensionPath }))
    await new Promise((resolve, reject) => {
      tempFile.once('finish', resolve)
      tarStream.once('error', reject)
      tarStream
        .pipe(zlib.createGzip())
        .pipe(tempFile)
    })

    return archivePath
  }

  /**
   * @param {String} extensionId
   * @param {String} extensionVersion
   * @param {Object} [options]
   * @param {Number} [options.pollInterval]
   * @param {Number} [options.preprocessTimeout]
   * @returns {Promise}
   */
  async _ensureExtensionVersionUploaded (extensionId, extensionVersion, { pollInterval, preprocessTimeout }) {
    const startedAt = new Date()

    do {
      const version = await this.dcHttpClient.getExtensionVersion(extensionId, extensionVersion)

      switch (version.status) {
        case 'UPLOADED':
          break

        case 'ERROR':
          if (Array.isArray(version.logs) && version.logs.length) {
            const errorLogs = version.logs.map(({ trace, name }) => trace || name || 'Empty log')
            throw new Error(t('ERROR_PREPROCESSING_ERROR_REASON', { reason: errorLogs.join('\n') }))
          }
          throw new Error(t('ERROR_PREPROCESSING_ERROR'))

        case 'PREPROCESSING':
          if (Date.now() - startedAt > preprocessTimeout) {
            throw new Error(t('ERROR_PREPROCESSING_TOO_LONG'))
          }
          await utils.sleep(pollInterval)
          continue

        default:
          throw new Error(t('ERROR_UNEXPECTED_STATUS', { status: version.status }))
      }

      break
    } while (true)
  }

  /**
   * @returns {Promise}
   */
  async _getAllExtensionProperties () {
    let attachedExtensions = await this.appSettings.loadAttachedExtensions()
    attachedExtensions = Object.keys(attachedExtensions)

    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    const files = await fsEx.readdir(extensionsFolder)

    const extensionInfo = await Promise.all(files.map(file => this._getExtensionInfo(file, true)))

    return files.reduce((properties, file, index) => {
      if (extensionInfo[index]) {
        const { id, type } = extensionInfo[index]
        const extensionProperties = {
          id,
          dir: file,
          attached: attachedExtensions.includes(id)
        }

        if (type === 'theme') {
          extensionProperties.isTheme = true
        }

        properties.push(extensionProperties)
      }
      return properties
    }, [])
  }

  /**
   * @param {String} extensionName
   * @returns {Promise}
   */
  _checkIfExtensionExists (extensionName) {
    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER, utils.getExtensionDirectoryName(extensionName))
    return fsEx.pathExists(extensionsFolder)
      .then((exists) => {
        if (exists) throw new Error(t('ERROR_EXTENSION_EXISTS', { extensionName }))
      })
  }

  /**
   * @return {String[]} extensionId[]
   */
  async _getAllExtensions () {
    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    const files = await fsEx.readdir(extensionsFolder)

    const extensionInfo = await Promise.all(files.map(file => this._getExtensionInfo(file, true)))
    return Promise.all(files.filter((file, index) => extensionInfo[index]))
  }

  /**
   * @param {String} extensionFolderName
   * @param {Boolean} ignoreNotExisting
   * @return {Promise<ExtensionInfo|void>} extensionId
   */
  async _getExtensionInfo (extensionFolderName, ignoreNotExisting) {
    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    const file = path.join(extensionsFolder, extensionFolderName, 'extension-config.json')
    if (!await fsEx.exists(file)) {
      if (!ignoreNotExisting) logger.error(t('ERROR_FILE_NOT_EXISTS', { file }))
      return
    }

    try {
      const json = await fsEx.readJSON(file)
      if (!json.id) return logger.warn(t('ERROR_NO_ID_IN_FILE', { file }))
      json.trusted = json.trusted || false
      return json
    } catch (e) {
      logger.warn(t('ERROR_INVALID_JSON_IN_FILE', { file }))
    }
  }
}

module.exports = ExtensionAction
