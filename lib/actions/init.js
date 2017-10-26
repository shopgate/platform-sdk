const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const inquirer = require('inquirer')
const FOLDERS = [AppSettings.SETTINGS_FOLDER, 'extensions', 'themes', 'pipelines']
const path = require('path')
const mkdirp = require('mkdirp')

function init (options, cb) {
  if (!UserSettings.getInstance().getSession().hasToken()) throw new Error('not logged in')

  let appSettings
  try {
    appSettings = AppSettings.getInstance()
  } catch (err) {
    return getAppId(options, appId => {
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

function getAppId (options, cb) {
  if (options.appId) return cb(options.appId)
  inquirer.prompt([{type: 'input', name: 'appId', message: 'Enter your Application ID:'}]).then(answers => cb(answers.appId))
}

module.exports = init
module.exports.cmd = commander => {
  commander
    .command('init')
    .description('init the sdk')
    .option('--appId <appId>', 'set the Application ID you want to initialize')
    .action(init)
}
