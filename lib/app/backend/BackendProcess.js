const io = require('socket.io-client')
const async = require('neo-async')
const logger = require('../../logger')
const AppSettings = require('../AppSettings')
const UserSettings = require('../../user/UserSettings')
const ExtensionWatcher = require('../../ExtensionWatcher')
const StepExecutor = require('./extensionRuntime/StepExecutor')

class BackendProcess {
  constructor (options) {
    this.dcAddress = process.env.SGCLOUD_DC_ADDRESS || 'https://developer-connector.shopgate.cloud'
    this.socket = null
    this.extensionWatcher = new ExtensionWatcher(options)
    this.executor = new StepExecutor(logger, options)
  }

  connect (cb) {
    logger.info('Establishing SDK connection')

    const extraHeaders = {
      Authorization: 'Bearer ' + UserSettings.getInstance().getSession().getToken()
    }

    this.socket = io(this.dcAddress, {extraHeaders, transports: ['websocket']})
    this.socket.on('connect_error', () => {
      logger.warn('Connection error! Trying to reconnect...')
    })
    this.socket.on('error', (err) => {
      logger.error(err)
    })

    this.extensionWatcher.on('attach', (extensionId) => {
      logger.info(`Extension ${extensionId} added`)

      this.socket.emit('registerExtension', {extensionId}, (err) => {
        if (err) return logger.error(`Error while attaching the extension ${extensionId}: ${err.message}`)
        logger.info(`Extension ${extensionId} attached`)
      })
    })

    this.extensionWatcher.on('detach', (extensionId) => {
      this.socket.emit('deregisterExtension', {extensionId}, (err) => {
        if (err) return logger.error(`Error while detaching the extension ${extensionId}: ${err.message}`)
        logger.info(`Extension ${extensionId} detached`)
      })
    })

    this.socket.on('stepCall', (data, cb) => this.stepCall(data, cb))
    this.socket.on('updateToken', (data, cb) => this.updateToken(data, cb))

    this.executor.start((err) => {
      if (err) return cb(err)

      async.parallel([
        (pCb) => this.executor.watch(pCb),
        (pCb) => this.extensionWatcher.start(pCb),
        (pCb) => {
          let cbCalled = false
          this.socket.on('connect', () => {
            logger.info('SDK connection established')
            this.socket.emit('selectApplication', {applicationId: AppSettings.getInstance().getId()}, (err) => {
              if (err) return cb(err)
              logger.info(`Selected Application ${AppSettings.getInstance().getId()}`)
              if (cbCalled) return
              cbCalled = true
              pCb()
            })
          })
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
   * @param {Object} data
   * @param cb
   */
  updateToken (data, cb) {
    const userSettings = UserSettings.getInstance()
    userSettings.getSession().setToken(data)
    userSettings.save()
  }

  disconnect (cb = () => {}) {
    async.parallel([
      (pCb) => this.extensionWatcher.stop(pCb),
      (pCb) => this.executor.stop(pCb),
      (pCb) => {
        if (!this.socket) return pCb()
        if (this.socket.disconnected) return pCb()

        this.socket.removeListener('error')
        this.socket.disconnect()
        async.retry(
          {times: 5, interval: 10},
          (acb) => {
            if (this.socket.disconnected) return acb()
            acb(new Error('Not disconnected'))
          },
          pCb
        )
      }
    ], cb)
  }
}

module.exports = BackendProcess
