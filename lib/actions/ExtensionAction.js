const path = require('path')
const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const logger = require('../logger')
const EXTENSION_CONFIG = 'extension-config.json'
const inquirer = require('inquirer')
// const request = require('request')
// const unzip = require('unzip')
// const replace = require('replace-in-file')
// const childProcess = require('child_process')

// TODO: ask for trusted!

class ExtensionAction {
  /**
   * @param {Command} commander
   */
  register (commander) {
    commander
      .command('extension-create [types...]')
      .description('creates a new extension')
      .option('--extension [extensionName]', 'Name of the new extension')
      .option('--organization [organizationName]', 'Name of the organization this extension belongs to')
      .action(this.createExtension.bind(this))

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

  getUserInput (options, types = []) {
    const userInput = {
      extensionName: options.extension,
      organizationName: options.organization,
      toBeCreated: {
        frontend: types.includes('frontend'),
        backend: types.includes('backend')
      }
    }

    return new Promise((resolve, reject) => {
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

      if (questions.length > 0) {
        inquirer.prompt(questions)
          .then((answers) => {
            if (answers.extensionName) userInput.extensionName = answers.extensionName
            if (answers.organizationName) userInput.organizationName = answers.organizationName
            if (answers.types && answers.types.includes('frontend')) userInput.toBeCreated.frontend = true
            if (answers.types && answers.types.includes('backend')) userInput.toBeCreated.backend = true
            if (userInput.toBeCreated.backend === false && userInput.toBeCreated.frontend === false) throw new Error('No extension type selected')
            resolve(userInput)
          })
          .catch(err => reject(err))
      } else {
        resolve(userInput)
      }
    })
  }

  createExtension (types, options) {
    if (!UserSettings.getInstance().getSession().getToken()) throw new Error('not logged in')
    this.settings = AppSettings.getInstance()

    let userInput = null
    let cloned = false
    let moved = false

    const extensionsFolder = process.env.APP_PATH ? path.join(process.env.APP_PATH, AppSettings.EXTENSIONS_FOLDER) : AppSettings.EXTENSIONS_FOLDER
    const defaultPath = path.join(extensionsFolder, 'cloud-sdk-boilerplate-extension-master')
    let extensionPath = null

    this.getUserInput(options, types)
      .then((ui) => {
        console.log(ui)
        userInput = ui
      })
      // .then(() => {
      //   // Download boilerplate
      //   return new Promise((resolve, reject) => {
      //     const extractor = unzip.Extract({ path: extensionsFolder })
      //     extractor.on('close', () => {
      //       cloned = true
      //       resolve()
      //     })
      //     extractor.on('error', (err) => reject(err))

      //     request('https://github.com/shopgate/cloud-sdk-boilerplate-extension/archive/master.zip').pipe(extractor)
      //   })
      // })
      // .then(() => {
      //   // Rename boilerplate
      //   const ePath = path.join(extensionsFolder, userInput.extensionName)
      //   return fsEx.move(defaultPath, ePath)
      //     .then(() => {
      //       extensionPath = ePath
      //       moved = true
      //     })
      // })
      // .then(() => {
      //   // Remove unused dirs
      //   const promises = []

      //   if (!userInput.toBeCreated.frontend) promises.push(fsEx.remove(path.join(extensionPath, 'frontend')))
      //   if (!userInput.toBeCreated.backend) {
      //     promises.push(fsEx.remove(path.join(extensionPath, 'extension')))
      //     promises.push(fsEx.remove(path.join(extensionPath, 'pipelines')))
      //   }

      //   return Promise.all(promises)
      // })
      // .then(() => {
      //   // Replace all occurrences
      //   return replace({
      //     files: [
      //       `${extensionPath}/**/*.json`,
      //       `${extensionPath}/**/*.js`
      //     ],
      //     from: [
      //       /awesomeExtension/g,
      //       /awesomeOrgani[s|z]ation/g
      //     ],
      //     to: [
      //       userInput.extensionName,
      //       userInput.organizationName
      //     ]})
      //     .catch(err => {
      //       // Because replace fails if no files match the pattern ...
      //       if (err.message.startsWith('No files match the pattern')) return logger.debug(err.message)
      //       throw err
      //     })
      // })
      // .then(() => {
      //   // Rename default pipeline
      //   if (userInput.toBeCreated.backend) {
      //     const pipelineDirPath = path.join(extensionPath, 'pipelines')
      //     return fsEx.move(path.join(pipelineDirPath, 'awesomeOrganization.awesomePipeline.json'), path.join(pipelineDirPath, `${userInput.organizationName}.awesomePipeline.json`))
      //   }
      // })
      // .then(() => {
      //   // Install dependencies
      //   if (userInput.toBeCreated.frontend) {
      //     const frontendPath = path.join(extensionPath, 'frontend')

      //     return new Promise((resolve, reject) => {
      //       logger.info('Installing frontend depenencies ...')
      //       const installProcess = childProcess.spawn('npm', ['i'], { env: process.env, cwd: frontendPath, stdio: 'inherit' })
      //       installProcess.on('error', (err) => logger.error(err))
      //       installProcess.on('exit', (code, signal) => {
      //         if (code === 0) return resolve()
      //         reject(new Error(`npm install process exited with code ${code} and signal ${signal}`))
      //       })
      //     })
      //   }
      // })
      .catch((err) => {
        logger.error(err)
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
