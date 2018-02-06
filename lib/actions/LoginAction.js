const inquirer = require('inquirer')
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
      .action((args, options) => { new LoginAction().run(options) })
  }

  /**
   * @param {object} options
   */
  async run (options) {
    this.options = options
    const {username, password} = await this.getUsernameAndPassword()
    const userSettings = new UserSettings()
    return new Promise((resolve, reject) => {
      new DcHttpClient(userSettings).login(username, password, (err) => {
        if (err) return reject(err)
        userSettings.setUsername(username)
        resolve()
      })
    })
  }

  async getUsernameAndPassword () {
    let username = this.options.username || process.env.SGCLOUD_USER
    let password = this.options.password || process.env.SGCLOUD_PASS

    const inquirerPrompt = []
    if (!username) {
      const usernamePromptOptions = {type: 'input', name: 'username', message: 'Enter your email address:'}
      const previousUsername = await new UserSettings().getUsername()
      if (previousUsername !== undefined) {
        usernamePromptOptions.default = previousUsername
      }
      inquirerPrompt.push(usernamePromptOptions)
    }
    if (!password) inquirerPrompt.push({type: 'password', name: 'password', message: 'Enter your password:'})

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
