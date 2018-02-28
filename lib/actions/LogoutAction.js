const logger = require('../logger')
const UserSettings = require('../user/UserSettings')

class LogoutAction {
  /**
   * @param {Command} caporal
   */
  static register (caporal) {
    caporal
      .command('logout')
      .description('Logout')
      .action(async () => {
        try {
          await new LogoutAction().run()
        } catch (err) {
          if (err) return logger.error(err.message)
          logger.info('Logout successful')
        }
      })
  }

  async run () {
    await new UserSettings().setToken(null)
  }
}

module.exports = LogoutAction
