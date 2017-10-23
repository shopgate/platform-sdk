const Settings = require('../user/Settings')
const fs = require('fs')
const App = require('../app/App')
const inquirer = require('inquirer')
const FOLDERS = ['extensions', 'themes', 'pipelines']

function init (cmd) {
  if (!Settings.getInstance().getSession().hasToken()) throw new Error('not logged in')

  const app = App.getInstance()
  if (app.id) throw new Error(`The current folder is already initialized for application ${app.id}`)

  getAppId(cmd, appId => {
    app.setId(appId).save()

    FOLDERS.forEach(folder => {
      if (!fs.existsSync(folder)) fs.mkdirSync(folder)
    })
  })
}

function getAppId (cmd, cb) {
  if (cmd.appId) return cb(cmd.appId)
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
