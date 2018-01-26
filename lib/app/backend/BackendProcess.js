const EventEmitter = require('events')
const io = require('socket.io-client')
const async = require('neo-async')

class BackendProcess extends EventEmitter {
  constructor (userSettings, appSettings, logger, stepExecutor) {
    super()
    this.userSettings = userSettings
    this.appSettings = appSettings
    this.logger = logger
    this.dcAddress = process.env.SGCLOUD_DC_ADDRESS || 'https://developer-connector.shopgate.cloud'
    this.socket = null
    this.executor = stepExecutor
  }

  connect () {
    return new Promise((resolve, reject) => {
      this.logger.info('Establishing SDK connection')

      const extraHeaders = {Authorization: 'Bearer ' + this.userSettings.getToken()}

      this.socket = io(this.dcAddress, {extraHeaders, transports: ['websocket'], autoConnect: false})
      this.socket
        .on('connect_error', () => this.logger.warn('Connection error! Trying to reconnect...'))
        .on('error', (err) => this.logger.error(err))
        .on('stepCall', (data, cb) => this.stepCall(data, cb))
        .on('updateToken', (data) => this.updateToken(data))
        .on('reconnect', () => this.emit('reconnect'))

      this.socket.on('connect', () => resolve())
      this.socket.connect()
    })
  }

  async attachExtension (extensionInfo) {
    this.logger.info(`Trying to attach ${extensionInfo.id} (trusted: ${extensionInfo.trusted}) ...`)
    try {
      await this._emitToSocket('registerExtension', {extensionId: extensionInfo.id, trusted: extensionInfo.trusted})
      this.logger.info(`Extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}) attached`)
    } catch (err) {
      this.logger.error(`Error while attaching the extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}): ${err.message}`)
    }
  }

  async detachExtension (extensionInfo) {
    try {
      await this._emitToSocket('deregisterExtension', {extensionId: extensionInfo.id, trusted: extensionInfo.trusted})
      this.logger.info(`Extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}) detached`)
    } catch (err) {
      this.logger.error(`Error while detaching the extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}): ${err.message}`)
    }
  }

  async selectApplication (applicationId) {
    await this._emitToSocket('selectApplication', {applicationId})
    this.logger.info(`Selected application ${applicationId}`)
  }

  async resetPipelines () {
    await this._emitToSocket('resetPipelines')
    this.logger.info(`Reset application`)
  }

  async reloadPipelineController () {
    await this._emitToSocket('reloadPipelines')
    this.logger.info(`Activated local pipelines on the remote server`)
  }

  async startStepExecutor () {
    await this.executor.start()
    await this.executor.startWatcher()
  }

  _emitToSocket (event, data = null) {
    return new Promise((resolve, reject) => {
      if (data) {
        return this.socket.emit(event, data, (err, result) => {
          if (err) return reject(err)
          resolve(result)
        })
      }
      return this.socket.emit(event, (err, result) => {
        if (err) return reject(err)
        resolve(result)
      })
    })
  }

  /**
   * @param {Object} data
   * @param {Object} data.stepMetaData
   * @param {String} data.stepMetaData.id
   * @param {String} data.stepMetaData.path
   * @param {Error|null} data.stepMetaData.catchableError
   * @param {Boolean} data.stepMetaData.isErrorCatching
   * @param {Object} data.stepMetaData.meta
   * @param {Object} data.input
   * @param cb
   */
  stepCall (data, cb) {
    this.executor.execute(data.input, data.stepMetaData, cb)
  }

  /**
   * @param {String} token
   */
  updateToken (token) {
    this.userSettings.setToken(token)
  }

  async disconnect () {
    await this.executor.stopWatcher()
    try {
      await this.executor.stop()
    } catch (err) {
      this.logger.debug(err)
    }

    if (!this.socket) return
    if (this.socket.disconnected) return

    this.socket.removeListener('error')
    this.socket.disconnect()

    await new Promise((resolve, reject) => {
      async.retry(
        {times: 5, interval: 10},
        (acb) => {
          if (this.socket.disconnected) return acb()
          acb(new Error('Not disconnected'))
        },
        (err) => {
          if (err) return reject(err)
          resolve()
        }
      )
    })
  }
}

module.exports = BackendProcess
