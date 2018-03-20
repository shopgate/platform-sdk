const logger = require('../logger')

class LogoutAction {
  static build (userSettings) {
    return new LogoutAction(userSettings)
  }
  /**
   * @param {Command} caporal
   * @param {AppSettings} appSettings
   * @param {UserSettings} userSettings
   */
  static register (caporal, appSettings, userSettings) {
    caporal
      .command('logout')
      .description('Logout')
      .action(async () => {
        try {
          await LogoutAction.build(userSettings).run()
          if (/^win/.test(process.platform)) {
            process.kill(process.pid, 'SIGTERM')
          }
          return
        } catch (err) {
          // istanbul ignore next
          logger.error(err.message)
          process.exit(1)
        }
      })
  }

  /**
   * @param {UserSettings} userSettings
   */
  constructor (userSettings) {
    this.userSettings = userSettings
  }

  async run () {
    await this.userSettings.setToken(null)
    logger.info('Logout successful')
  }
}

module.exports = LogoutAction
