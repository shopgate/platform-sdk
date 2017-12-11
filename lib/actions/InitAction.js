const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const logger = require('../logger')
const { SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, THEMES_FOLDER } = require('../app/AppSettings')
const inquirer = require('inquirer')
const FOLDERS = [SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, THEMES_FOLDER]
const path = require('path')
const fsEx = require('fs-extra')

class InitAction {
  /**
   * @param {Command} commander
   */
  register (commander) {
    commander
      .command('init')
      .description('init the sdk')
      .option('--appId <appId>', 'set the Sandbox App ID you want to initialize')
      .action((options) => this.run(options, (err, appId) => {
        if (err) return logger.error(err.message)
        logger.info(`The Application "${appId}" was successfully initialized`)
      }))
  }

  /**
   * @param {object} options
   * @param {function} [cb]
   */
  run (options, cb) {
    this.options = options
    if (!UserSettings.getInstance().getSession().getToken()) cb(new Error('not logged in'))

    try {
      AppSettings.getInstance()

      return this.permitDeletion(inquirer.prompt, (err, overwrite) => {
        if (err) return cb(err)
        if (!overwrite) return cb(new Error('Initialization aborted'))
        this.getAppId(inquirer.prompt, (err, appId) => {
          if (err) return cb(err)
          this.resetApplication()
          this.initApplication(appId, cb)
        })
      })
    } catch (err) {
      return this.getAppId(inquirer.prompt, (err, appId) => {
        if (err) return cb(err)
        if (!appId) return cb(new Error('Sandbox App ID (--appId) is invalid'))

        FOLDERS.forEach(folder => {
          if (process.env.APP_PATH) folder = path.join(process.env.APP_PATH, folder)
          fsEx.ensureDir(folder)
        })
        this.initApplication(appId, cb)
      })
    }
  }

  /**
   * @param {*} prompt
   * @param {function} cb
   */
  getAppId (prompt, cb) {
    if (this.options.appId) return cb(null, this.options.appId)
    prompt([{type: 'input', name: 'appId', message: 'Enter your Sandbox App ID:'}]).then(answers => cb(null, answers.appId))
  }

  permitDeletion (prompt, cb) {
    prompt({type: 'input', name: 'overwrite', message: 'Do you really want to overwrite your current application? (y/n)'}).then(answers => {
      return cb(null, answers.overwrite === 'y')
    })
  }

  resetApplication () {
    const appPath = process.env.APP_PATH ? process.env.APP_PATH : ''
    fsEx.emptyDirSync(path.join(appPath, 'pipelines'))
    fsEx.emptyDirSync(path.join(appPath, 'trustedPipelines'))
    fsEx.emptyDirSync(path.join(appPath, '.sgcloud'))
   // fsEx.removeSync(path.join(appPath, 'extensions', '**', 'extension-config.json')) // TODO: All configs are overwritten anyways on changes
   // fsEx.removeSync(path.join(appPath, 'themes', '**', 'config', 'app.json'))
  }

  initApplication (appId, cb) {
    const appSettings = new AppSettings()
    appSettings.setId(appId)
    appSettings.save()
    appSettings.init()

    AppSettings.setInstance(appSettings)
    cb(null, appId)
  }
}

module.exports = InitAction
