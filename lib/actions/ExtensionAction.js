const path = require('path')
const fsEx = require('fs-extra')
const inquirer = require('inquirer')
const request = require('request')
const unzip = require('unzip')
const replace = require('replace-in-file')
const childProcess = require('child_process')

const logger = require('../logger')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')

const DEFAULT_NAME = 'cloud-sdk-boilerplate-extension-master'
const BOILERPLATE_URL = process.env['BOILERPLATE_URL'] || 'https://github.com/shopgate/cloud-sdk-boilerplate-extension/archive/master.zip'

class ExtensionAction {
  /**
   * @param {Command} caporal
   */
  static register (caporal) {
    caporal
      .command('extension create')
      .description('Creates a new extension')
      .argument('[types...]', 'Types of the extension. Possible types are: frontend, backend')
      .option('--extension [extensionName]', 'Name of the new extension')
      .option('--organization [organizationName]', 'Name of the organization this extension belongs to')
      .option('--trusted [type]', 'only valid if you\'re about to create a backend extension')
      .action(new ExtensionAction().createExtension.bind(this))

    caporal
      .command('extension attach')
      .argument('[extensions...]', 'Folder name of the extensions to attach')
      .description('Attaches one or more extensions')
      .action(new ExtensionAction().attachExtensions.bind(this))

    caporal
      .command('extension detach')
      .argument('[extensions...]', 'Folder name of the extensions to detach')
      .description('Detaches one or more extensions')
      .action(new ExtensionAction().detachExtensions.bind(this))
  }

  /**
   * @param {object} options
   * @param {string[]} types
   */
  getUserInput (options, types = [], externalUserInput) {
    const userInput = {
      extensionName: options.extension,
      organizationName: options.organization,
      trusted: options.trusted ? options.trusted === 'true' : null,
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
        choices: ['backend', 'frontend']
      })
    }

    if (!userInput.extensionName) {
      questions.push({
        name: 'extensionName',
        message: 'Extension name:',
        validate: (input) => {
          if (!input) return 'Please provide a valid input'
          return true
        },
        when: (answers) => {
            // Consider it unnecessary if there isn't a type neigher in answers.types nor types
          return (answers.types && answers.types.length) > 0 || types.length > 0
        }
      })
    }

    if (!userInput.organizationName) {
      questions.push({
        name: 'organizationName',
        message: 'organization name:',
        validate: (input) => {
          if (!input) return 'Please provide a valid input'
          return true
        },
          // Consider it unnecessary if there isn't a type neigher in answers.types nor types
        when: (answers) => (answers.types && answers.types.length) || types.length > 0
      })
    }

    if (userInput.trusted === null) {
      questions.push({
        name: 'trusted',
        message: 'Does your backend extension need to run in a trusted environment?',
        type: 'list',
        choices: ['yes', 'no']
      })
    }

    return new Promise((resolve, reject) => {
      if (questions.length > 0) {
        return inquirer.prompt(questions).then((answers) => {
          if (answers.extensionName) userInput.extensionName = answers.extensionName
          if (answers.organizationName) userInput.organizationName = answers.organizationName
          if (answers.types && answers.types.includes('frontend')) userInput.toBeCreated.frontend = true
          if (answers.types && answers.types.includes('backend')) userInput.toBeCreated.backend = true
          if (answers.trusted) userInput.trusted = answers.trusted === 'yes'
          if (userInput.toBeCreated.backend === false && userInput.toBeCreated.frontend === false) throw new Error('No extension type selected')
          Object.assign(externalUserInput, userInput)
          resolve()
        })
        .catch(err => reject(err))
      }

      Object.assign(externalUserInput, userInput)
      resolve()
    })
  }

  /**
   * @param {string} extensionsFolder
   * @param {object} state
   */
  downloadBoilerplate (extensionsFolder, state) {
    logger.debug('Downloading boilerplate ...')
    return new Promise((resolve, reject) => {
      const extractor = unzip.Extract({ path: extensionsFolder })
      extractor.on('close', () => {
        logger.debug('Downloading boilerplate ... done')
        state.cloned = true
        resolve()
      })
      extractor.on('error', (err) => {
        if (process.env['LOG_LEVEL'] === 'debug') logger.error(err)
        reject(new Error(`Error while downloading boilerplate: ${err.message}`))
      })
      request(BOILERPLATE_URL).pipe(extractor)
    })
  }

  /**
   * @param {object} userInput
   * @param {string} defaultPath
   * @param {string} extensionsFolder
   * @param {object} state
   */
  renameBoilerplate (userInput, defaultPath, extensionsFolder, state) {
    logger.debug('Renamig boilerplate ...')
    const ePath = path.join(extensionsFolder, userInput.extensionName)
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
   * @param {string} state
   */
  removeUnusedDirs (userInput, state) {
    const promises = []

    if (!userInput.toBeCreated.frontend) promises.push(fsEx.remove(path.join(state.extensionPath, 'frontend')))
    if (!userInput.toBeCreated.backend) {
      promises.push(fsEx.remove(path.join(state.extensionPath, 'extension')))
      promises.push(fsEx.remove(path.join(state.extensionPath, 'pipelines')))
    }

    if (promises.length > 0) logger.debug('Removing unused dirs ...')

    return Promise.all(promises).then(logger.debug('Removing unused dirs .. done'))
  }

  /**
   * @param {object} userInput
   * @param {string} state
   */
  removePlaceHolders (userInput, state) {
    logger.debug('Removing placeholders ...')
    return replace({
      files: [
        `${state.extensionPath}/**/*.json`,
        `${state.extensionPath}/**/*.js`
      ],
      from: [
        /awesomeExtension/g,
        /awesomeOrgani[s|z]ation/g
      ],
      to: [
        userInput.extensionName,
        userInput.organizationName
      ]})
        .then((changes) => { logger.debug(`Removing placeholders in ${changes} ... done`) })
        .catch(err => {
          // Because replace fails if no files match the pattern ...
          if (err.message.startsWith('No files match the pattern')) return logger.debug(err.message)
        })
  }

  /**
   * @param {object} userInput
   * @param {string} state
   */
  updateBackendFiles (userInput, state) {
    if (!userInput.toBeCreated.backend) return

    logger.debug('Updating backend files')

    const promises = []

      // Rename default pipeline
    const pipelineDirPath = path.join(state.extensionPath, 'pipelines')
    promises.push(fsEx.move(path.join(pipelineDirPath, 'awesomeOrganization.awesomePipeline.json'), path.join(pipelineDirPath, `${userInput.organizationName}.awesomePipeline.json`)))

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
   * @param {object} command
   */
  installFrontendDependencies (userInput, state, command) {
    if (!userInput.toBeCreated.frontend) return
    command = command || {command: /^win/.test(process.platform) ? 'npm.cmd' : 'npm', params: ['i']}

    const frontendPath = path.join(state.extensionPath, 'frontend')

    return new Promise((resolve, reject) => {
      logger.info('Installing frontend depenencies ...')
      const installProcess = childProcess.spawn(command.command, command.params, { env: process.env, cwd: frontendPath, stdio: 'inherit' })
      installProcess.on('exit', (code, signal) => {
        if (code === 0) return resolve()
        reject(new Error(`Install process exited with code ${code} and signal ${signal}`))
      })
    })
  }

  cleanUp (state, defaultPath) {
    if (state.cloned) fsEx.removeSync(state.moved ? state.extensionPath : defaultPath)
  }

  /**
   * @param {string[]} types
   * @param {object} options
   */
  createExtension ({types}, options) {
    new UserSettings().validate()
    this.settings = new AppSettings().validate()

    const userInput = {}
    let state = {
      cloned: false,
      moved: false,
      extensionPath: null
    }

    const extensionsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.EXTENSIONS_FOLDER) : AppSettings.EXTENSIONS_FOLDER
    const defaultPath = path.join(extensionsFolder, DEFAULT_NAME)

    return this.getUserInput(options, types, userInput)
      .then(() => this.downloadBoilerplate(extensionsFolder, state))
      .then(() => this.renameBoilerplate(userInput, defaultPath, extensionsFolder, state))
      .then(() => this.removeUnusedDirs(userInput, state))
      .then(() => this.removePlaceHolders(userInput, state))
      .then(() => this.updateBackendFiles(userInput, state))
      .then(() => this.installFrontendDependencies(userInput, state))
      .then(() => logger.info(`Extension "${userInput.extensionName}" created successfully`))
      .catch((err) => {
        logger.error(`An error occured while creating the extension: ${err}`)
        this.cleanUp(state, defaultPath)
      })
  }

  /**
   * @param {String[]} extensions
   */
  attachExtensions ({extensions = []}) {
    new UserSettings().validate()
    this.settings = new AppSettings().validate()

    let force = false
    if (!extensions.length) {
      extensions = this.getAllExtensions()
      force = true
    }
    extensions.forEach((extensionFolderName) => {
      const extensionInfo = this.getExtensionInfo(extensionFolderName, true)
      if (!extensionInfo) {
        return logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
      }
      this.settings.attachExtension(extensionFolderName, extensionInfo, force)
    })
  }

  /**
   * @param {String[]} extensions
   */
  detachExtensions ({extensions = []}) {
    new UserSettings().validate()
    this.settings = new AppSettings().validate()

    if (!extensions.length) {
      this.settings.detachAllExtensions()
    } else {
      extensions.forEach((extensionFolderName) => {
        const extensionInfo = this.getExtensionInfo(extensionFolderName, true)
        if (!extensionInfo) {
          return logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
        }

        this.settings.detachExtension(extensionInfo.id)
      })
    }
  }

  /**
   * @return {String[]} extensionId[]
   */
  getAllExtensions () {
    const extensionsFolder = path.join(this.settings.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER)
    const files = fsEx.readdirSync(extensionsFolder)
    const exts = []
    files.forEach(file => {
      if (this.getExtensionInfo(file, true)) exts.push(file)
    })
    return exts
  }

  /**
   * @param {String} extensionName
   * @param {Boolean} ignoreNotExisting
   * @return {String} extensionId
   */
  getExtensionInfo (extensionName, ignoreNotExisting) {
    const extensionsFolder = path.join(this.settings.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER)
    const file = path.join(extensionsFolder, extensionName, 'extension-config.json')
    if (!fsEx.existsSync(file)) {
      if (!ignoreNotExisting) logger.error(`"${file}" does not exist`)
      return
    }

    try {
      const json = fsEx.readJSONSync(file)
      if (!json.id) return logger.warn(`"${file}" has no "id"-property`)
      return {
        id: json.id,
        trusted: json.trusted || false
      }
    } catch (e) {
      logger.warn(`"${file}" is invalid json`)
    }
  }
}

module.exports = ExtensionAction
