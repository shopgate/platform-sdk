const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const logger = require('../logger')

class BackendAction {
  /**
   * @param {Command} commander
   */
  register (commander) {
    commander
      .command('backend <action>')
      .description('establish a connection to the development system')
      .action(this.run.bind(this))
  }

  run (action) {
    if (!UserSettings.getInstance().getSession().hasToken()) throw new Error('not logged in')
    const settings = AppSettings.getInstance()

    if (action !== 'start') throw new Error(`unknown action "${action}"`)

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
}

module.exports = BackendAction
