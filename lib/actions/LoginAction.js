const inquirer = require('inquirer')
const logger = require('../logger')
const t = require('../i18n')(__filename)

class LoginAction {
  /**
   * @param {Command} caporal
   * @param {AppSettings} appSettings
   * @param {UserSettings} userSettings
   * @param {DcHttpClient} dcHttpClient
   */
  static register (caporal, appSettings, userSettings, dcHttpClient) {
    caporal
      .command('login')
      .description(t('LOGIN_DESCRIPTION'))
      .option('--username [email]', t('LOGIN_EMAIL_DESCRIPTION'))
      .option('--password [password]', t('LOGIN_PASSWORD_DESCRIPTION'))
      .action(async (args, options) => {
        try {
          await new LoginAction(userSettings, dcHttpClient).run(options)
        } catch (err)  /* istanbul ignore next */ {
          logger.error(err.message)
          return process.exit(1)
        }
      })
  }

  /**
   * @param {UserSettings} userSettings
   * @param {DcHttpClient} dcHttpClient
   */
  constructor (userSettings, dcHttpClient) {
    this.userSettings = userSettings
    this.dcHttpClient = dcHttpClient
  }

  /**
   * @param {object} options
   */
  async run (options) {
    this.options = options
    const { username, password } = await this.getUsernameAndPassword()
    await this.dcHttpClient.login(username, password)
    await this.userSettings.setUsername(username)
    logger.info(t('LOGIN_SUCCESSFULL'))
  }

  async getUsernameAndPassword () {
    let username = this.options.username || process.env.SGCLOUD_USER
    let password = this.options.password || process.env.SGCLOUD_PASS

    const inquirerPrompt = []
    if (!username) {
      const usernamePromptOptions = { type: 'input', name: 'username', message: `${t('INPUT_USERNAME')}:` }
      const previousUsername = await this.userSettings.getUsername()
      if (previousUsername !== undefined) {
        usernamePromptOptions.default = previousUsername
      }
      inquirerPrompt.push(usernamePromptOptions)
    }
    if (!password) inquirerPrompt.push({ type: 'password', name: 'password', message: `${t('INPUT_PASSWORD')}:` })

    if (inquirerPrompt.length) {
      const answers = await inquirer.prompt(inquirerPrompt)
      return {
        username: answers.username || username,
        password: answers.password || password
      }
    }

    return {
      username, password
    }
  }
}

module.exports = LoginAction
