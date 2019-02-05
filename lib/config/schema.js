const os = require('os')
const path = require('path')

module.exports = {
  userDirectory: {
    doc: 'Path to directory where user settings will be stored',
    format: String,
    default: os.homedir(),
    env: 'USER_DIR'
  },
  workingDirectory: {
    doc: 'Path to directory containing a Shopgate Connect extensions',
    format: String,
    default: process.cwd(),
    env: 'WORKING_DIR'
  },
  userSettingsDirectory: {
    doc: '',
    format: String,
    default: '',
    env: 'USER_PATH'
  },
  localesDirectory: {
    doc: 'Path to directory where locales reside',
    format: String,
    default: path.join('.', 'lib', 'locales'),
    env: 'LOCALES_DIR'
  },
  locale: {
    doc: 'Messages locale',
    format: String,
    default: 'en',
    env: 'LOCALE'
  }
}
