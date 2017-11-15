const fsEx = require('fs-extra')
const path = require('path')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const ExtensionConfigWatcher = require('../ExtensionConfigWatcher')
const DCHttpClient = require('../DCHttpClient')
const logger = require('../logger')

class BackendAction {
  /**
   * @param {Command} commander
   */
  register (commander) {
    commander
      .command('backend <action>')
      .description('establish a connection to the development system')
      .action(this.run.bind(this))
  }

  run (action) {
    if (!UserSettings.getInstance().getSession().hasToken()) throw new Error('not logged in')

    if (action !== 'start') throw new Error(`unknown action "${action}"`)

    AppSettings.getInstance().init()
    this.configWatcher = new ExtensionConfigWatcher()
    this.dcClient = new DCHttpClient()

    const backendProcess = new BackendProcess()
    backendProcess.connect(err => {
      if (err) throw err
      this.configWatcher.start()
      this.configWatcher.on('configChange', (config) => {
        this.dcClient.generateExtensionConfig(config.file, AppSettings.getInstance().getId(), UserSettings.getInstance().getSession(), (err, extConfig) => {
          if (err) throw err
          fsEx.outputJsonSync(path.join(config.path, 'extension', 'config.json'), extConfig)
          logger.info(`Updated ${config.file.id}`)
        })
      })
    })

    process.on('SIGINT', () => {
      this.configWatcher.close(() => {
        backendProcess.disconnect()
        backendProcess.extensionWatcher.close()
        logger.info('SDK connection closed')
        process.exit(0)
      })
    })
  }
}

module.exports = BackendAction
