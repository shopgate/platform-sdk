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
const EXTENSION_NAME_REGEX = /^@[A-Za-z][A-Za-z0-9-_]{0,213}\/[A-Za-z][A-Za-z0-9-_]{0,213}$/

class ExtensionAction {
  /**
   * @param {Command} caporal
   * @param {AppSettings} appSettings
   */
  static register (caporal, appSettings) {
    caporal
      .command('extension create')
      .description('Creates a new extension')
      .argument('[types...]', 'Types of the extension. Possible types are: frontend, backend')
      .option('--extension [extensionName]', 'Name of the new extension (e.g: @myAwesomeOrg/awesomeExtension)')
      .option('--trusted [type]', 'only valid if you\'re about to create a backend extension')
      .action((args, options) => new ExtensionAction(appSettings).createExtension(args, options))

    caporal
      .command('extension attach')
      .argument('[extensions...]', 'Folder name of the extensions to attach')
      .description('Attaches one or more extensions')
      .action((args) => new ExtensionAction(appSettings).attachExtensions(args))

    caporal
      .command('extension detach')
      .argument('[extensions...]', 'Folder name of the extensions to detach')
      .description('Detaches one or more extensions')
      .action((args) => new ExtensionAction(appSettings).detachExtensions(args))
  }

  /**
   * @param {AppSettings} appSettings
   */
  constructor (appSettings) {
    this.appSettings = appSettings
  }

  /**
   * @param {object} options
   * @param {string[]} types
   * @param {object} externalUserInput
   */
  _getUserInput (options, types = [], externalUserInput) {
    const userInput = {
      extensionName: options.extension,
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

    if (userInput.trusted === null) {
      questions.push({
        name: 'trusted',
        message: 'Does your backend extension need to run in a trusted environment?',
        type: 'list',
        choices: ['yes', 'no'],
        default: 'no',
        when: (answers) => {
          // Consider it unnecessary if there isn't a type neigher in answers.types nor types
          return (answers.types && answers.types.length) > 0 || types.length > 0
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
        })
          .catch(err => reject(err))
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
      const extractor = unzip.Extract({path: extensionsFolder})
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
    promises.push(fsEx.move(path.join(pipelineDirPath, 'awesomeOrganization.awesomePipeline.json'), path.join(pipelineDirPath, `${userInput.organizationName}.awesomePipeline.json`)))

    // Add trusted if necessary
    if (userInput.trusted) {
      const exConfPath = path.join(state.extensionPath, 'extension-config.json')

      const p = fsEx.readJSON(exConfPath)
        .then((exConf) => {
          exConf.trusted = userInput.trusted
          return fsEx.writeJson(exConfPath, exConf, {spaces: 2})
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
    command = command || {command: /^win/.test(process.platform) ? 'npm.cmd' : 'npm', params: ['i']}

    const frontendPath = path.join(state.extensionPath, 'frontend')

    return new Promise((resolve, reject) => {
      logger.info('Installing frontend depenencies ...')
      const installProcess = childProcess.spawn(command.command, command.params, {
        env: process.env,
        cwd: frontendPath,
        stdio: 'inherit'
      })
      installProcess.on('exit', (code, signal) => {
        if (code === 0) return resolve()
        reject(new Error(`Install process exited with code ${code} and signal ${signal}`))
      })
    })
  }

  _cleanUp (state, defaultPath) {
    if (state.cloned) fsEx.removeSync(state.moved ? state.extensionPath : defaultPath)
  }

  /**
   * @param {string[]} types
   * @param {object} options
   */
  async createExtension ({types}, options) {
    new UserSettings().validate()
    await this.appSettings.validate()

    const userInput = {}
    let state = {
      cloned: false,
      moved: false,
      extensionPath: null
    }

    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER)
    const defaultPath = path.join(extensionsFolder, DEFAULT_NAME)

    return this._getUserInput(options, types, userInput)
      .then(() => this._checkIfExtensionExists(userInput.extensionName))
      .then(() => this._downloadBoilerplate(extensionsFolder, state))
      .then(() => this._renameBoilerplate(userInput, defaultPath, extensionsFolder, state))
      .then(() => this._removeUnusedDirs(userInput, state))
      .then(() => this._removePlaceholders(userInput, state))
      .then(() => this._updateBackendFiles(userInput, state))
      .then(() => this._installFrontendDependencies(userInput, state))
      .then(() => logger.info(`Extension "${userInput.extensionName}" created successfully`))
      .catch((err) => {
        logger.error(`An error occured while creating the extension: ${err}`)
        this._cleanUp(state, defaultPath)
      })
  }

  /**
   * @param {String[]} A list of extension folder names (path, relative to the "extensions" folder).
   */
  async attachExtensions ({extensions = []}) {
    new UserSettings().validate()
    await this.appSettings.validate()

    let force = false
    if (!extensions.length) {
      extensions = await this._getAllExtensions()
      force = true
    }

    const extensionInfo = await Promise.all(extensions.map(extensionFolderName => this._getExtensionInfo(extensionFolderName, true)))

    return Promise.all(extensions
      .reduce((processedExtensions, extensionFolderName, index) => {
        if (!extensionInfo[index]) {
          logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
        } else {
          processedExtensions.push({extensionFolderName, extensionInfo: extensionInfo[index]})
        }

        return processedExtensions
      }, [])
      .map(processedExtension => this.appSettings.attachExtension(processedExtension.extensionFolderName, processedExtension.extensionInfo, force))
    )
  }

  /**
   * @param {String[]} A list of extension folder names (path, relative to the "extensions" folder).
   */
  async detachExtensions ({extensions = []}) {
    new UserSettings().validate()
    await this.appSettings.validate()

    if (!extensions.length) {
      await this.appSettings.detachAllExtensions()
      return
    }

    const extensionInfo = await Promise.all(extensions.map(extensionFolderName => this._getExtensionInfo(extensionFolderName, true)))

    return Promise.all(extensions
      .reduce((processedExtensions, extensionFolderName, index) => {
        if (!extensionInfo[index]) {
          logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
        } else {
          processedExtensions.push({extensionFolderName, extensionInfo: extensionInfo[index]})
        }

        return processedExtensions
      }, [])
      .map(processedExtension => this.appSettings.detachExtension(processedExtension.extensionInfo.id))
    )
  }

  _checkIfExtensionExists (extensionName) {
    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER, extensionName.replace('/', '-'))
    return fsEx.pathExists(extensionsFolder)
      .then((exists) => {
        if (exists) throw new Error(`The extension '${extensionName}' already exists`)
      })
  }

  /**
   * @return {String[]} extensionId[]
   */
  async _getAllExtensions () {
    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER)
    const files = await fsEx.readdir(extensionsFolder)

    const extensionInfo = await Promise.all(files.map(file => this._getExtensionInfo(file, true)))
    return Promise.all(files.filter((file, index) => extensionInfo[index]))
  }

  /**
   * @param {String} extensionName
   * @param {Boolean} ignoreNotExisting
   * @return {String|void} extensionId
   */
  async _getExtensionInfo (extensionName, ignoreNotExisting) {
    const extensionsFolder = path.join(this.appSettings.getApplicationFolder(), AppSettings.EXTENSIONS_FOLDER)
    const file = path.join(extensionsFolder, extensionName, 'extension-config.json')
    if (!await fsEx.exists(file)) {
      if (!ignoreNotExisting) logger.error(`"${file}" does not exist`)
      return
    }

    try {
      const json = await fsEx.readJSON(file)
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
