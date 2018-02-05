const inquirer = require('inquirer')
const logger = require('../logger')
const DcHttpClient = require('../DcHttpClient')
const UserSettings = require('../user/UserSettings')

class LoginAction {
  /**
   * @param {Command} caporal
   */
  static register (caporal) {
    caporal
      .command('login')
      .description('Login')
      .option('--username [email]', 'Email address to login')
      .option('--password [password]', 'Password to login')
      .action((args, options) => new LoginAction().run(options, (err) => {
        if (err) return logger.error(err.message)
        logger.info('Login successful')
      }))
  }

  /**
   * @param {object} options
   * @param {function} [cb]
   */
  run (options, cb) {
    this.options = options

    this.getUsernameAndPassword((err, username, password) => {
      if (err) return cb(err)
      const userSettings = new UserSettings()
      new DcHttpClient(userSettings).login(username, password, (err) => {
        if (err) return cb(err)
        userSettings.setUsername(username)
        cb()
      })
    })
  }

  /**
   * @param {function} [cb]
   */
  getUsernameAndPassword (cb) {
    let username = this.options.username || process.env.SGCLOUD_USER
    let password = this.options.password || process.env.SGCLOUD_PASS

    const inquirerPrompt = []
    if (!username) {
      const usernamePromptOptions = {type: 'input', name: 'username', message: 'Enter your email address:'}
      const previousUsername = new UserSettings().getUsername()
      if (previousUsername !== undefined) {
        usernamePromptOptions.default = previousUsername
      }
      inquirerPrompt.push(usernamePromptOptions)
    }
    if (!password) inquirerPrompt.push({type: 'password', name: 'password', message: 'Enter your password:'})

    if (inquirerPrompt.length) {
      return inquirer.prompt(inquirerPrompt).then(answers => {
        cb(null, answers.username || username, answers.password || password)
      })
    }

    cb(null, username, password)
  }
}

module.exports = LoginAction
