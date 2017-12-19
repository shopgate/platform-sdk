const io = require('socket.io-client')
const async = require('neo-async')
const AttachedExtensionsWatcher = require('../AttachedExtensionsWatcher')
const StepExecutor = require('./extensionRuntime/StepExecutor')

class BackendProcess {
  constructor (userSettings, appSettings, logger) {
    this.userSettings = userSettings
    this.appSettings = appSettings
    this.logger = logger
    this.dcAddress = process.env.SGCLOUD_DC_ADDRESS || 'https://developer-connector.shopgate.cloud'
    this.socket = null
    this.attachedExtensionsWatcher = new AttachedExtensionsWatcher(appSettings)
    this.executor = new StepExecutor(logger)
  }

  connect (cb) {
    this.logger.info('Establishing SDK connection')

    const extraHeaders = {Authorization: 'Bearer ' + this.userSettings.getToken()}

    this.socket = io(this.dcAddress, {extraHeaders, transports: ['websocket'], autoConnect: false})
    this.socket
      .on('connect_error', () => this.logger.warn('Connection error! Trying to reconnect...'))
      .on('error', (err) => this.logger.error(err))
      .on('stepCall', (data, cb) => this.stepCall(data, cb))
      .on('updateToken', (data) => this.updateToken(data))

    this.attachedExtensionsWatcher.on('attach', (extensionInfo) => {
      this.logger.info(`Extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}) added`)
      this.socket.emit('registerExtension', {extensionId: extensionInfo.id, trusted: extensionInfo.trusted}, (err) => {
        if (err) return this.logger.error(`Error while attaching the extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}): ${err.message}`)
        this.logger.info(`Extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}) attached`)
      })
    })

    this.attachedExtensionsWatcher.on('detach', (extensionInfo) => {
      this.socket.emit('deregisterExtension', {extensionId: extensionInfo.id, trusted: extensionInfo.trusted}, (err) => {
        if (err) return this.logger.error(`Error while detaching the extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}): ${err.message}`)
        this.logger.info(`Extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}) detached`)
      })
    })

    this.executor.start((err) => {
      if (err) return cb(err)
      this.logger.debug('Step Executor started')
      async.parallel([
        (pCb) => this.executor.startWatcher(pCb),
        (pCb) => {
          let initialConnect = false
          this.socket.on('connect', () => {
            this.logger.info('SDK connection established')
            const applicationId = this.appSettings.getId()
            this.socket.emit('selectApplication', {applicationId}, (err) => {
              if (err) return cb(err)
              this.logger.info(`Selected Application ${applicationId}`)
              if (initialConnect) return
              initialConnect = true
              this.attachedExtensionsWatcher.start(pCb)
            })
          })
          this.socket.connect()
        }
      ], cb)
    })
  }

  /**
   * @param {Object} data
   * @param {Object} data.stepMetaData
   * @param {String} data.stepMetaData.id
   * @param {String} data.stepMetaData.path
   * @param {Error|null} data.stepMetaData.catchableError
   * @param {Object} data.stepMetaData.meta
   * @param {Object} data.input
   * @param cb
   */
  stepCall (data, cb) {
    this.executor.execute(data.input, data.stepMetaData, cb)
  }

  /**
   * @param {Object} token
   * @param cb
   */
  updateToken (token) {
    this.userSettings.setToken(token)
  }

  disconnect (cb = () => {}) {
    this.executor.stopWatcher(() => {
      this.executor.stop((err) => {
        if (err) this.log.debug(err)

        if (!this.socket) return cb()
        if (this.socket.disconnected) return cb()

        this.socket.removeListener('error')
        this.socket.disconnect()
        async.retry(
          {times: 5, interval: 10},
          (acb) => {
            if (this.socket.disconnected) return acb()
            acb(new Error('Not disconnected'))
          },
          cb
        )
      })
    })
  }
}

module.exports = BackendProcess
