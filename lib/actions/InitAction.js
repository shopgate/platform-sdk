const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const inquirer = require('inquirer')
const FOLDERS = [AppSettings.SETTINGS_FOLDER, 'extensions', 'themes', 'pipelines']
const path = require('path')
const mkdirp = require('mkdirp')

class InitAction {
  /**
   * @param {object} commander
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
    if (!UserSettings.getInstance().getSession().hasToken()) throw new Error('not logged in')

    let appSettings
    try {
      appSettings = AppSettings.getInstance()
    } catch (err) {
      return this.getAppId(appId => {
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
   * @param options
   * @param cb
   * @returns {*}
   */
  getAppId (cb) {
    if (this.options.appId) return cb(this.options.appId)
    inquirer.prompt([{type: 'input', name: 'appId', message: 'Enter your Application ID:'}]).then(answers => cb(answers.appId))
  }
}

module.exports = InitAction
