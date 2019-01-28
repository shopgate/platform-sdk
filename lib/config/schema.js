const os = require('os')

module.exports = {
  userDirectory: {
    doc: '',
    format: String,
    default: os.homedir(),
    env: 'USER_DIR'
  },
  workingDirectory: {
    doc: '',
    format: String,
    default: process.cwd(),
    env: 'WORKING_DIR'
  },
  userSettingsDirectory: {
    doc: '',
    format: String,
    default: '',
    env: 'USER_PATH'
  }
}
