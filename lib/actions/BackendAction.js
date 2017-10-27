const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const logger = require('../logger')

/* istanbul ignore next */
function start () {
  if (!UserSettings.getInstance().getSession().hasToken()) throw new Error('not logged in')
  const settings = AppSettings.getInstance()

  const connection = new BackendProcess()
  connection.connect(err => {
    if (err) throw err

    connection.selectApplication(settings.getId(), err => {
      if (err) throw err
    })
  })

  process.on('SIGINT', () => {
    connection.disconnect()
    logger.info('SDK connection closed')
    process.exit(0)
  })
}

module.exports = start
module.exports.cmd = commander => {
  commander
    .command('backend start')
    .description('establish a connection to the development system')
    .action(start)
}
