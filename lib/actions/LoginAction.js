const inquirer = require('inquirer')
const DCHttpClient = require('../DCHttpClient')
const Settings = require('../user/UserSettings')

class LoginAction {
  /**
   * @param {Command} commander
   */
  register (commander) {
    commander
      .command('login')
      .description('login')
      .option('--username [email]', 'Username/E-Mail to login')
      .option('--password [password]', 'Password to login')
      .action(this.run.bind(this))
  }

  /**
   * @param {object} options
   * @param {function} [cb]
   */
  run (options, cb) {
    this.options = options

    this.getUsernameAndPassword((err, username, password) => {
      if (err) throw err

      const client = new DCHttpClient()
      client.login(username, password, (err, token) => {
        if (err) {
          if (cb) return cb(err)
          throw err
        }

        const settings = Settings.getInstance()
        settings.getSession().setToken(token)
        settings.save()
        if (cb) cb()
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
    if (!username) inquirerPrompt.push({type: 'input', name: 'username', message: 'Enter your username'})
    if (!password) inquirerPrompt.push({type: 'password', name: 'password', message: 'Enter your password'})

    if (inquirerPrompt.length) {
      return inquirer.prompt(inquirerPrompt).then(answers => {
        cb(null, answers.username || username, answers.password || password)
      })
    }

    cb(null, username, password)
  }
}

module.exports = LoginAction
