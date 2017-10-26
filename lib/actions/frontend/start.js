// const { spawn } = require('child_process')
const AppSettings = require('../../app/AppSettings')
const rapidServer = require('../../app/frontend/rapidServer')

function start (cmd) {
  const appSettings = AppSettings.getInstance()
  rapidServer(appSettings)
}

module.exports = start
module.exports.cmd = commander => {
  commander
    .command('frontend start')
    .description('start the frontend sdk')
    // .option('--appId <appId>', 'set the Application ID you want to initialize')
    .action(start)
}
