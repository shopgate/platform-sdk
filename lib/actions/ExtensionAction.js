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

const DEFAULT_NAME = 'cloud-sdk-boilerplate-extension-master'
const EXTENSION_NAME_REGEX = /^@[A-Za-z][A-Za-z0-9-_]{0,213}\/[A-Za-z][A-Za-z0-9-_]{0,213}$/

const { EXTENSIONS_FOLDER } = require('../app/Constants')

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
      .description('Creates a new extension')
      .argument('[types...]', 'Types of the extension. Possible types are: frontend, backend')
      .option('--extension [extensionName]', 'Name of the new extension (e.g: @myAwesomeOrg/awesomeExtension)')
      .option('--trusted [type]', 'only valid if you\'re about to create a backend extension')
      .action(async (args, options) => {
        await ExtensionAction.build(appSettings, userSettings).createExtension(args, options).catch(exceptionHandler)
      })

    caporal
      .command('extension attach')
      .argument('[extensions...]', 'Folder name of the extensions to attach')
      .description('Attaches one or more extensions')
      .action(async (args) => {
        await ExtensionAction.build(appSettings, userSettings).attachExtensions(args).catch(exceptionHandler)
      })

    caporal
      .command('extension detach')
      .argument('[extensions...]', 'Folder name of the extensions to detach')
      .description('Detaches one or more extensions')
      .action(async (args) => {
        await ExtensionAction.build(appSettings, userSettings).detachExtensions(args).catch(exceptionHandler)
      })

    caporal
      .command('extension manage')
      .description('Attaches and detaches extensions via a select picker')
      .action(async () => {
        await ExtensionAction.build(appSettings, userSettings).manageExtensions().catch(exceptionHandler)
      })

    caporal
      .command('extension upload')
      .description('Uploads local extension to Shopgate Developer Center')
      .argument('[extension]', 'Directory name of the extension to upload')
      .option('-f, --force', 'Skip a prompt to create a new version and create the version automatically in draft')
      .option('-t, --preprocess-timeout <ms>', 'Preprocessing timeout, milliseconds', caporal.INT, 60e4)
      .option('-i, --poll-interval', 'The interval of polling of the uploaded file status, milliseconds', caporal.INT, 3000)
      .action(async (args, options) => {
        await ExtensionAction.build(appSettings, userSettings, dcHttpClient).uploadExtension(args, options).catch(exceptionHandler)
      })

    caporal
      .command('theme upload')
      .description('Uploads local theme to Shopgate Developer Center')
      .argument('[theme]', 'Directory name of the theme to upload')
      .option('--force', 'Skip a prompt to create a new version and create the version automatically in draft')
      .option('--preprocess-timeout <ms>', 'Preprocessing timeout, milliseconds', caporal.INT, 12e4)
      .option('--poll-interval', 'The interval of polling of the uploaded file status, milliseconds', caporal.INT, 3000)
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
        message: 'What type of extension are you about to create?',
        type: 'checkbox',
        validate: (input) => {
          if (input.length === 0) return 'Please select at least one type'
          return true
        },
        default: ['backend', 'frontend'],
        choices: ['backend', 'frontend']
      })
    }

    if (!userInput.extensionName || !EXTENSION_NAME_REGEX.test(userInput.extensionName)) {
      questions.push({
        name: 'extensionName',
        message: 'Extension name (e.g: @myAwesomeOrg/awesomeExtension):',
        validate: (input) => {
          const valid = /^@[A-Za-z][A-Za-z0-9-_]{0,213}\/[A-Za-z][A-Za-z0-9-_]{0,213}$/.test(input)
          if (!valid) return 'Please provide an extension name in the following format: @<organizationName>/<name>'
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
        message: 'Does your backend extension need to run in a trusted environment?',
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
          if (userInput.toBeCreated.backend === false && userInput.toBeCreated.frontend === false) throw new Error('No extension type selected')
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
    logger.debug('Downloading boilerplate ...')

    return new Promise((resolve, reject) => {
      const extractor = unzip.Extract({ path: `${extensionsFolder}/${DEFAULT_NAME}` })
      extractor.on('close', () => {
        logger.debug('Downloading boilerplate ... done')
        state.cloned = true
        resolve()
      })
      extractor.on('error', (err) => {
        if (process.env['LOG_LEVEL'] === 'debug') logger.error(err)
        reject(new Error(`Error while downloading boilerplate: ${err.message}`))
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
    logger.debug('Renamig boilerplate ...')
    const ePath = path.join(extensionsFolder, userInput.extensionName.replace('/', '-'))
    return new Promise((resolve, reject) => {
      fsEx.rename(defaultPath, ePath, (err) => {
        if (err) {
          if (process.env['LOG_LEVEL'] === 'debug') logger.error(err)
          return reject(new Error(`Error while renaming boilerplate ${err.message}`))
        }
        state.extensionPath = ePath
        state.moved = true
        logger.debug('Renamig boilerplate ... done')
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

    if (promises.length > 0) logger.debug('Removing unused dirs ...')

    return Promise.all(promises).then(logger.debug('Removing unused dirs ... done'))
  }

  /**
   * @param {object} userInput
   * @param {object} state
   */
  _removePlaceholders (userInput, state) {
    logger.debug(`Removing placeholders in ${state.extensionPath} ...`)
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
      .then((changes) => logger.debug(`Removing placeholders in ${changes} ... done`))
      .catch(err => {
        // Because replace fails if no files match the pattern ...
        if (err.message.startsWith('No files match the pattern')) return logger.debug(err.message)
      })
  }

  /**
   * @param {object} userInput
   * @param {object} state
   */
  _updateBackendFiles (userInput, state) {
    if (!userInput.toBeCreated.backend) return

    logger.debug('Updating backend files')

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

    return Promise.all(promises).then(logger.debug('Updating backend files ... done'))
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
      logger.info('Installing frontend depenencies ...')
      const installProcess = childProcess.spawn(command.command, command.params, {
        env: process.env,
        cwd: frontendPath,
        stdio: stdioMode
      })
      installProcess.on('exit', (code, signal) => {
        if (code === 0) return resolve()
        reject(new Error(`Install process exited with code ${code} and signal ${signal}`))
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
      logger.info(`Extension "${userInput.extensionName}" created successfully`)
    } catch (err) {
      logger.error(`An error occured while creating the extension: ${err}`)
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
          logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
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
          logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
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
    const extensionPropeties = await this._getAllExtensionProperties()

    if (extensionPropeties.length === 0) {
      return logger.warn(`There are no extensions in folder '.${path.sep}${EXTENSIONS_FOLDER}'`)
    }

    const selected = (await inquirer.prompt({
      type: 'checkbox',
      name: 'extensions',
      message: 'Select extensions to attach',
      pageSize: 10,
      choices: extensionPropeties.map(({ id, attached }) => ({
        name: id,
        checked: attached
      }))
    })).extensions.map((selectedId) => {
      // Collect the dirnames of the selected extensions
      return extensionPropeties.find(({ id }) => id === selectedId).dir
    })

    // Create dirname lists of the available extensions since they are needed later to attach in detach
    const attached = extensionPropeties.filter(({ attached }) => attached).map(({ dir }) => dir)
    const detached = extensionPropeties.filter(({ attached }) => !attached).map(({ dir }) => dir)

    const toBeAttached = selected.filter(entry => detached.includes(entry))
    const toBeDetached = attached.filter(entry => !selected.includes(entry))

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
    const extensionsDirectory = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    const extensionPath = path.resolve(extensionsDirectory, extensionDir)
    const extensionConfigPath = path.resolve(extensionPath, 'extension-config.json')
    try {
      await extensionConfigValidator.validate(extensionConfigPath)
    } catch (err) {
      const relativeExtensionsConfigPath = path.relative(process.cwd(), extensionConfigPath)
      throw new Error(`Validation of .${path.sep}${relativeExtensionsConfigPath} failed: ${err.message}`)
    }

    const archivePath = await utils.runSpinner(`Packing ${extensionIdVersion}`, () => this._packExtension(extensionPath))
    logger.debug(`Packed ${extensionIdVersion} into ${archivePath}`)

    try {
      await utils.runSpinner(`Uploading ${extensionIdVersion}`, () =>
        this.dcHttpClient.uploadExtensionFile(extensionId, extensionVersion, archivePath, { forceVersionCreate: options.force })
      )
    } catch (err) {
      if (err instanceof NotFoundError && err.message.toLowerCase() === 'version not found' && !options.force) {
        const { createVersion } = await inquirer.prompt({
          type: 'confirm',
          name: 'createVersion',
          message: `Version ${extensionVersion} does not exist. Create it automatically?`,
          default: true
        })

        if (createVersion) {
          await utils.runSpinner(`Uploading ${extensionIdVersion}`, () =>
            this.dcHttpClient.uploadExtensionFile(extensionId, extensionVersion, archivePath, { forceVersionCreate: true })
          )
        } else {
          throw new Error(`Version ${extensionVersion} was not created. Please log in to the Shopgate Developer Center to create it manually, or run the previous command again.`)
        }
      } else if (err instanceof ConflictError && err.data && err.data.code === 'WAITING_FOR_REVIEW') {
        const { cancelReview } = await inquirer.prompt({
          type: 'confirm',
          name: 'cancelReview',
          message: `Version ${extensionVersion} has already been submitted for review. Uploading will cancel this review. Do you want to proceed?`,
          default: true
        })

        if (cancelReview) {
          await utils.runSpinner(`Uploading ${extensionIdVersion}`, () =>
            this.dcHttpClient.uploadExtensionFile(extensionId, extensionVersion, archivePath, { cancelReview: true })
          )
        } else {
          throw new SoftError(`Version ${extensionVersion} of ${extensionId} is waiting for review`)
        }
      } else if (err instanceof NotFoundError && err.message.toLowerCase() === 'extension not found') {
        throw new Error(`${isTheme ? 'Theme' : 'Extension'} ${extensionId} was not found. Please log in to the Shopgate Developer Center to create it.`)
      } else {
        throw err
      }
    } finally {
      logger.debug(`Deleting ${archivePath}`)
      await fsEx.remove(archivePath)
    }
    logger.debug(`Uploaded ${extensionIdVersion}`)

    await utils.runSpinner(`Preprocessing ${extensionIdVersion}`, () => {
      const { pollInterval, preprocessTimeout } = options
      return this._ensureExtensionVersionUploaded(extensionId, extensionVersion, { pollInterval, preprocessTimeout })
    })
    logger.debug(`Preprocessing of ${extensionIdVersion} finished`)

    logger.plain(`${isTheme ? 'Theme' : 'Extension'} ${extensionIdVersion} was successfully uploaded`)
  }

  /**
   * @param {String} extensionDir
   * @param {Boolean} isTheme
   * @returns {Promise}
   */
  async _resolveExtensionInfo (extensionDir, isTheme = false) {
    const extensionsDirectory = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    const extensionInfo = {}

    if (extensionDir) {
      const extensionPath = path.resolve(extensionsDirectory, extensionDir)
      if (!(await fsEx.exists(extensionPath))) {
        throw new Error(`${isTheme ? 'Theme' : 'Extension'} directory ${extensionDir} does not exist`)
      }
    } else {
      const extensionPropeties = await this._getAllExtensionProperties()
      const choices = extensionPropeties
        .filter((extension) => !isTheme || extension.isTheme)
        .map(({ id, dir }) => ({ name: id, value: dir }))

      if (choices.length === 0) {
        const relativeExtensionsDirectory = path.relative(process.cwd(), extensionsDirectory)
        throw new Error(`There are no ${isTheme ? 'themes' : 'extensions'} in '.${path.sep}${relativeExtensionsDirectory}'`)
      }

      extensionDir = (await inquirer.prompt({
        type: 'list',
        name: 'extensionDir',
        message: `Select ${isTheme ? 'a theme' : 'an extension'} to upload`,
        pageSize: 10,
        choices
      })).extensionDir
    }

    try {
      const extensionConfigPath = path.resolve(extensionsDirectory, extensionDir, 'extension-config.json')
      const relativeExtensionsConfigPath = path.relative(process.cwd(), extensionConfigPath)
      const extensionConfig = await fsEx.readJSON(extensionConfigPath)

      let errorMessage
      if (!extensionConfig) {
        errorMessage = `Invalid JSON in .${path.sep}${relativeExtensionsConfigPath}`
      } else if (!extensionConfig.id) {
        errorMessage = `There is no 'id' property in .${path.sep}${relativeExtensionsConfigPath}`
      } else if (!extensionConfig.version) {
        errorMessage = `There is no 'version' property in .${path.sep}${relativeExtensionsConfigPath}`
      }

      if (errorMessage) throw new Error(errorMessage)

      extensionInfo.extensionId = extensionConfig.id
      extensionInfo.extensionDir = extensionDir
      extensionInfo.extensionVersion = extensionConfig.version

      if (isTheme && extensionConfig.type !== 'theme') {
        logger.warn(`${extensionConfig.id} exists but is not marked as theme (type: "theme")`)
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        err.message = `There is no extension-config.json in ${extensionDir}`
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

    logger.debug('Building a list of exclusions based on .gitignore file')
    let ignorePatterns
    try {
      const gitignorePath = path.resolve(extensionPath, '.gitignore')
      const gitignoreContents = await fsEx.readFile(gitignorePath)
      ignorePatterns = parseGitignore(gitignoreContents)
    } catch (err) {
      logger.debug(`.gitignore does not exist in ${extensionPath}. Using defaults`)
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

    logger.debug(`Packing ${extensionPath} into tar archive...`)
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
            throw new Error(`Preprocessing error: ${errorLogs.join('\n')}`)
          }
          throw new Error(`Preprocessing error`)

        case 'PREPROCESSING':
          if (Date.now() - startedAt > preprocessTimeout) {
            throw new Error('Preprocessing is taking longer than expected. Follow the current status by logging in to http://developer.shopgate.com/admin.')
          }
          await utils.sleep(pollInterval)
          continue

        default:
          throw new Error(`Unexpected status: ${version.status}`)
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
    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER, extensionName.replace('/', '-'))
    return fsEx.pathExists(extensionsFolder)
      .then((exists) => {
        if (exists) throw new Error(`The extension '${extensionName}' already exists`)
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
      if (!ignoreNotExisting) logger.error(`"${file}" does not exist`)
      return
    }

    try {
      const json = await fsEx.readJSON(file)
      if (!json.id) return logger.warn(`"${file}" has no "id"-property`)
      json.trusted = json.trusted || false
      return json
    } catch (e) {
      logger.warn(`"${file}" is invalid json`)
    }
  }
}

module.exports = ExtensionAction
