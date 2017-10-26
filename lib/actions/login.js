const inquirer = require('inquirer')
const DCHttpClient = require('../DCHttpClient')
const Settings = require('../user/UserSettings')

function login (cmd, otions, cb) {
  getUsernameAndPassword(cmd, (username, password) => {
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

function getUsernameAndPassword (cmd, cb) {
  let username = cmd.username || process.env.SGCLOUD_USER
  let password = cmd.password || process.env.SGCLOUD_PASS

  const inquirerPrompt = []
  if (!username) inquirerPrompt.push({type: 'input', name: 'username', message: 'Enter your username'})
  if (!password) inquirerPrompt.push({type: 'password', name: 'password', message: 'Enter your password'})

  if (inquirerPrompt.length) {
    return inquirer.prompt(inquirerPrompt).then(answers => {
      cb(answers.username || username, answers.password || password)
    })
  }

  cb(username, password)
}

module.exports = login
module.exports.cmd = commander => {
  commander
    .command('login')
    .description('login')
    .option('--username [email]', 'Username/E-Mail to login')
    .option('--password [password]', 'Password to login')
    .action(login)
}
