const { fork } = require('child_process')
const { join } = require('path')
const AppSettings = require('../../app/AppSettings')

function start (cmd, options) {
  const appSettings = AppSettings.getInstance()
  const frontendSettings = appSettings.getFrontendSettings()

  fork(join(__dirname, '../../app/frontend/rapidDevServer'), {
    env: {
      silent: !!options.silent,
      appId: appSettings.getId(),
      ...frontendSettings
    }
  })
}

module.exports = start
module.exports.cmd = commander => {
  commander
    .command('frontend start')
    .description('start the frontend sdk')
    .action(start)
}
