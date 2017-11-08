const UserSettings = require('../user/UserSettings')
const AppSettings = require('../app/AppSettings')
const BackendProcess = require('../app/backend/BackendProcess')
const PipelineWatcher = require('../PipelineWatcher')
// const DCHttpClient = require('../DCHttpClient')
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
    const backendProcess = new BackendProcess()
   // const dcClient = new DCHttpClient()
    this.pipelineWatcher = new PipelineWatcher()

    backendProcess.connect(err => {
      if (err) throw err

     /* this.pipelineWatcher
        .start()
        .on('pipelineChanged', (pipeline) => {
          dcClient.updatePipeline(pipeline, AppSettings.getInstance().getId(), UserSettings.getInstance().getSession(), (err) => {
            if (err) {
              console.log(err)
              logger.error(`Could not update pipeline ${pipeline.pipeline.id}`)
              return
            }
            logger.info(`Updated pipeline ${pipeline.pipeline.id}`)
          })
        }) */
    })

    process.on('SIGINT', () => {
      backendProcess.disconnect()
      backendProcess.extensionWatcher.close()
      this.pipelineWatcher.stop()
      logger.info('SDK connection closed')
      process.exit(0)
    })
  }
}

module.exports = BackendAction
