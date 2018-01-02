const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const logger = require('../logger')
const EXTENSION_CONFIG = 'extension-config.json'
const inquirer = require('inquirer')
const request = require('request')
const unzip = require('unzip')
const replace = require('replace-in-file')
const childProcess = require('child_process')

const createExtensionQuestions = [
  {
    name: 'type',
    message: 'What type of extension are you about to create?',
    type: 'checkbox',
    choices: ['backend', 'frontend']
  },
  {
    name: 'extensionName',
    message: 'Extension name:',
    validate: (input) => {
      if (!input) return 'Please provide a valid input'
      return true
    },
    when: (answers) => answers.type.length > 0
  },
  {
    name: 'organisationName',
    message: 'Organisation name:',
    validate: (input) => {
      if (!input) return 'Please provide a valid input'
      return true
    },
    when: (answers) => answers.type.length > 0
  }
]

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
      case 'create':
        this.createExtension()
        break
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

  createExtension () {
    const userInput = {}
    let cloned = false
    let moved = false

    const defaultPath = path.join('extensions', 'cloud-sdk-boilerplate-extension-master')
    let extensionPath = null

    inquirer.prompt(createExtensionQuestions)
      .then((inquirerAnswers) => {
        // Map user input
        if (inquirerAnswers.type.length === 0) throw new Error('No extension type selected')
        userInput.toBeCreated = {
          frontend: inquirerAnswers.type.includes('frontend'),
          backend: inquirerAnswers.type.includes('backend')
        }
        userInput.extensionName = inquirerAnswers.extensionName
        userInput.organisationName = inquirerAnswers.organisationName
      })
      .then(() => {
        // Download boilerplate
        const extensionPath = path.join(`extensions`)

        return new Promise((resolve, reject) => {
          const extractor = unzip.Extract({ path: extensionPath })
          extractor.on('close', () => {
            cloned = true
            resolve()
          })
          extractor.on('error', (err) => reject(err))

          request('https://github.com/shopgate/cloud-sdk-boilerplate-extension/archive/master.zip').pipe(extractor)
        })
      })
      .then(() => {
        // Rename boilerplate
        const ePath = path.join('extensions', userInput.extensionName)
        return fsEx.move(defaultPath, ePath)
          .then(() => {
            extensionPath = ePath
            moved = true
          })
      })
      .then(() => {
        // Remove unused dirs
        const promises = []

        if (!userInput.toBeCreated.frontend) promises.push(fsEx.remove(path.join(`extensions`, userInput.extensionName, 'frontend')))
        if (!userInput.toBeCreated.backend) {
          promises.push(fsEx.remove(path.join(`extensions`, userInput.extensionName, 'extension')))
          promises.push(fsEx.remove(path.join(`extensions`, userInput.extensionName, 'pipelines')))
        }

        return Promise.all(promises)
      })
      .then(() => {
        // Replace all occurrences
        return replace({
          files: [
            `./extensions/${userInput.extensionName}/**/*.json`,
            `./extensions/${userInput.extensionName}/**/*.js`
          ],
          from: [
            /awesomeExtension/g,
            /awesomeOrganization/g
          ],
          to: [
            userInput.extensionName,
            userInput.organisationName
          ]})
      })
      .then(() => {
        if (userInput.toBeCreated.backend) {
          const pipelineDirPath = path.join(`extensions`, userInput.extensionName, 'pipelines')
          return fsEx.move(path.join(pipelineDirPath, 'awesomeOrganization.awesomePipeline.json'), path.join(pipelineDirPath, `${userInput.organisationName}.awesomePipeline.json`))
        }
      })
      .then(() => {
        if (userInput.toBeCreated.frontend) {
          const frontendPath = path.join(extensionPath, 'frontend')

          return new Promise((resolve, reject) => {
            logger.info('Installing frontend depenencies ...')
            const installProcess = childProcess.spawn('npm', ['i'], { env: process.env, cwd: frontendPath, stdio: 'inherit' })
            installProcess.on('error', (err) => logger.error(err))
            installProcess.on('exit', (code, signal) => {
              if (code === 0) return resolve()
              reject(new Error(`npm install process exited with code ${code} and signal ${signal}`))
            })
          })
        }
      })
      .catch((err) => {
        logger.error(err.message)
        if (cloned) fsEx.removeSync(moved ? extensionPath : defaultPath)
      })
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
    extensions.forEach((extensionFolderName) => {
      const extensionInfo = this.getExtensionInfo(extensionFolderName, true)
      if (!extensionInfo) {
        return logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
      }
      this.settings.attachExtension(extensionFolderName, extensionInfo, force)
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
      extensions.forEach((extensionFolderName) => {
        const extensionInfo = this.getExtensionInfo(extensionFolderName, true)
        if (!extensionInfo) {
          return logger.warn(`There is no extension in folder: './extensions/${extensionFolderName}'. Skipping... Please make sure that you only pass the folder name of the extension as argument.`)
        }

        this.settings.detachExtension(extensionInfo.id)
      })
      this.settings.save()
    }
  }

  /**
   * @return {String[]} extensionId[]
   */
  getAllExtensions () {
    const extensionsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.EXTENSIONS_FOLDER) : AppSettings.EXTENSIONS_FOLDER
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
    const extensionsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.EXTENSIONS_FOLDER) : AppSettings.EXTENSIONS_FOLDER
    const file = path.join(extensionsFolder, extensionName, EXTENSION_CONFIG)
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
