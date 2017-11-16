const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const { SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER } = require('../app/AppSettings')
const { THEMES_FOLDER, PWA_FOLDER } = require('../app/frontend/FrontendSettings')
const inquirer = require('inquirer')
const FOLDERS = [SETTINGS_FOLDER, EXTENSIONS_FOLDER, PIPELINES_FOLDER, THEMES_FOLDER, PWA_FOLDER]
const path = require('path')
const mkdirp = require('mkdirp')

class InitAction {
  /**
   * @param {Command} commander
   */
  register (commander) {
    commander
      .command('init')
      .description('init the sdk')
      .option('--appId <appId>', 'set the Application ID you want to initialize')
      .action(this.run.bind(this))
  }

  /**
   * @param {object} options
   * @param {function} [cb]
   */
  run (options, cb) {
    this.options = options
    if (!UserSettings.getInstance().getSession().getToken()) throw new Error('not logged in')

    let appSettings
    try {
      appSettings = AppSettings.getInstance()
    } catch (err) {
      return this.getAppId(inquirer.prompt, (err, appId) => {
        if (err) {
          if (cb) {
            return cb(err)
          } else {
            throw err
          }
        }

        FOLDERS.forEach(folder => {
          if (process.env.APP_PATH) folder = path.join(process.env.APP_PATH, folder)
          mkdirp.sync(folder)
        })

        AppSettings.setInstance(new AppSettings().setId(appId).save().init())
        if (cb) cb()
      })
    }

    throw new Error(`The current folder is already initialized for application ${appSettings.getId()}`)
  }

  /**
   * @param {*} prompt
   * @param {function} cb
   */
  getAppId (prompt, cb) {
    if (this.options.appId) return cb(null, this.options.appId)
    prompt([{type: 'input', name: 'appId', message: 'Enter your Application ID:'}]).then(answers => cb(null, answers.appId))
  }
}

module.exports = InitAction
