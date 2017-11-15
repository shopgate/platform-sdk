const fsEx = require('fs-extra')
const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const logger = require('../logger')
const DCHttpClient = require('../DCHttpClient')

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
    this.dcClient = new DCHttpClient()

    const backendProcess = new BackendProcess()
    backendProcess.connect(err => {
      if (err) throw err

      logger.info('Updating pipelines...')

      this.dcClient.getPipelines(AppSettings.getInstance().getId(), UserSettings.getInstance().getSession(), (err, pipelines) => {
        if (err) throw err
        fsEx.emptyDirSync('./pipelines')
        pipelines.forEach(pipeline => {
          fsEx.outputFileSync(`./pipelines/${pipeline.pipeline.id}.json`, JSON.stringify(pipeline, null, 2), 'UTF-8')
        })
        logger.info('Updated all pipelines')
      })
    })

    process.on('SIGINT', () => {
      backendProcess.disconnect()
      backendProcess.extensionWatcher.close()
      logger.info('SDK connection closed')
      process.exit(0)
    })
  }
}

module.exports = BackendAction
