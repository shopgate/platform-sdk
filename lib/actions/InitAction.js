const UserSettings = require('../user/UserSettings')
const DcHttpClient = require('../DcHttpClient')
const AppSettings = require('../app/AppSettings')
const logger = require('../logger')
const { SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, TRUSTED_PIPELINES_FOLDER, THEMES_FOLDER } = require('../app/AppSettings')
const inquirer = require('inquirer')
const path = require('path')
const fsEx = require('fs-extra')

const FOLDERS = [SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, TRUSTED_PIPELINES_FOLDER, THEMES_FOLDER]

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
    const userSettings = UserSettings.getInstance()
    const token = userSettings.getSession().getToken()
    if (!token) cb(new Error('not logged in'))

    let appSettings
    try {
      appSettings = AppSettings.getInstance()
    } catch (err) {
      return this.getAppId(inquirer.prompt, (err, appId) => {
        if (err) return cb(err)
        if (!appId) return cb(new Error('Sandbox App ID (--appId) is invalid'))

        FOLDERS.forEach(folder => {
          if (process.env.APP_PATH) folder = path.join(process.env.APP_PATH, folder)
          fsEx.ensureDir(folder)
        })

        new DcHttpClient(userSettings).getApplicationData(appId, (err) => {
          if (err) {
            logger.debug(err)
            if (cb) return cb(new Error(`The application ${appId} is not available or permissions are missing (message: ${err.message}). Please check the application at developer.shopgate.com!`))
          }

          AppSettings.setInstance(new AppSettings().setId(appId).save().init())
          cb(null, appId)
        })
      })
    }

    cb(new Error(`The current folder is already initialized for application ${appSettings.getId()}`))
  }

  /**
   * @param {*} prompt
   * @param {function} cb
   */
  getAppId (prompt, cb) {
    if (this.options.appId) return cb(null, this.options.appId)
    prompt([{type: 'input', name: 'appId', message: 'Enter your Sandbox App ID:'}]).then(answers => cb(null, answers.appId))
  }
}

module.exports = InitAction
