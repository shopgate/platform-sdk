const inquirer = require('inquirer')
const logger = require('../logger')
const DcHttpClient = require('../DcHttpClient')
const UserSettings = require('../user/UserSettings')

class LoginAction {
  /**
   * @param {Command} caporal
   */
  register (caporal) {
    caporal
      .command('login')
      .description('Login')
      .option('--username [email]', 'Email address to login')
      .option('--password [password]', 'Password to login')
      .action((args, options) => this.run(options, (err) => {
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
      new DcHttpClient(new UserSettings()).login(username, password, (err) => {
        if (err) return cb(err)
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
    if (!username) inquirerPrompt.push({type: 'input', name: 'username', message: 'Enter your email address:'})
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
