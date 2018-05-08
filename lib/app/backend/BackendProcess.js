const EventEmitter = require('events')
const io = require('socket.io-client')
const async = require('neo-async')

// @ts-check
class BackendProcess extends EventEmitter {
  /**
   * @param {UserSettings} userSettings
   * @param {Logger} logger
   * @param {StepExecutor} stepExecutor
   */
  constructor (userSettings, logger, stepExecutor) {
    super()
    this.userSettings = userSettings
    this.logger = logger
    this.dcAddress = process.env.SGCLOUD_DC_ADDRESS || 'https://developer-connector.shopgate.cloud'
    this.socket = null
    this.executor = stepExecutor
  }

  /**
   * @return {Promise<void>}
   */
  async connect () {
    const token = await this.userSettings.getToken()
    return new Promise((resolve) => {
      this.logger.info('Establishing SDK connection')

      const extraHeaders = { Authorization: 'Bearer ' + token }

      this.socket = io(this.dcAddress, { extraHeaders, transports: ['websocket'], autoConnect: false })
      this.socket
        .on('connect_error', () => this.logger.warn('Connection error! Trying to reconnect...'))
        .on('error', (err) => this.logger.error(err))
        .on('stepCall', (data, cb) => this.stepCall(data, cb))
        .on('updateToken', async (data) => { await this.updateToken(data) })
        .on('reconnect', () => this.emit('reconnect'))
        .on('disconnectedByOtherUser', async reason => { await this.disconnectedByOtherUser(reason) })
        .on('connectionInProgress', async reason => { await this.connectionInProgress(reason) })

      this.socket.on('connect', () => resolve())
      this.socket.connect()
    })
  }

  /**
   * @param  {ExtensionInfo} extensionInfo
   * @return {Promise<void>}
   */
  async attachExtension (extensionInfo) {
    this.logger.info(`Trying to attach ${extensionInfo.id} (trusted: ${extensionInfo.trusted}) ...`)
    try {
      await this._emitToSocket('registerExtension', { extensionId: extensionInfo.id, trusted: extensionInfo.trusted })
      this.logger.info(`Extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}) attached`)
    } catch (err) {
      this.logger.error(`Error while attaching the extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}): ${err.message}`)
    }
  }

  /**
   * @param  {ExtensionInfo} extensionInfo
   * @return {Promise<void>}
   */
  async detachExtension (extensionInfo) {
    try {
      await this._emitToSocket('deregisterExtension', { extensionId: extensionInfo.id, trusted: extensionInfo.trusted })
      this.logger.info(`Extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}) detached`)
    } catch (err) {
      this.logger.error(`Error while detaching the extension ${extensionInfo.id} (trusted: ${extensionInfo.trusted}): ${err.message}`)
    }
  }

  /**
   * @param  {string} applicationId
   * @return {Promise<void>}
   */
  async selectApplication (applicationId) {
    await this._emitToSocket('selectApplication', { applicationId })
    this.logger.info(`Selected application ${applicationId}`)
  }

  /**
   * @return {Promise<void>}
   */
  async resetPipelines () {
    await this._emitToSocket('resetPipelines')
    this.logger.info(`Reset application`)
  }

  /**
   * @return {Promise<void>}
   */
  async reloadPipelineController () {
    await this._emitToSocket('reloadPipelines')
    this.logger.info(`Activated local pipelines on the remote server`)
  }

  /**
   * @return {Promise<void>}
   */
  async startStepExecutor () {
    await this.executor.start()
    await this.executor.startWatcher()
  }

  /**
   * @return {Promise<any>}
   */
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
  async updateToken (token) {
    await this.userSettings.setToken(token)
  }

  /**
   * @param {boolean} [retry=true]
   * @returns {Promise<void>}
   */
  async disconnect (retry = true) {
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

    if (!retry) return

    await new Promise((resolve, reject) => {
      async.retry(
        { times: 5, interval: 10 },
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

  /**
   * @param {string} reason
   * @returns {Promise<void>}
   */
  async disconnectedByOtherUser (reason) {
    this.logger.info('Developer connector sent disconnect request. Reason: ' + reason)
    await this.disconnect(false)
    process.kill(process.pid, 'SIGINT')
  }

  /**
   * @param {string} reason
   * @returns {Promise<void>}
   */
  async connectionInProgress (reason) {
    this.logger.info('Developer connector sent disconnect request. Reason: ' + reason)
    await this.disconnect(false)
    process.kill(process.pid, 'SIGINT')
  }
}

module.exports = BackendProcess
