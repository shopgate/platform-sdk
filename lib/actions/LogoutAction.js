const logger = require('../logger')

class LogoutAction {
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
          await new LogoutAction(userSettings).run()
        } catch (err) {
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
