const logger = require('../logger')
const t = require('../i18n')(__filename)

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
      .description(t('LOGOUT_DESCRIPTION'))
      .action(async () => {
        try {
          await LogoutAction.build(userSettings).run()
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
    logger.info(t('LOGOUT_SUCCESSFULL'))
  }
}

module.exports = LogoutAction
