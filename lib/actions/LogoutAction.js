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
      .action(() => new LogoutAction().run((err) => {
        if (err) return logger.error(err.message)
        logger.info('Logout successful')
      }))
  }

  run () {
    new UserSettings().setToken(null)
  }
}

module.exports = LogoutAction
