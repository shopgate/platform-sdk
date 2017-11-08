const io = require('socket.io-client')
const async = require('neo-async')
const logger = require('../../logger')
const AppSettings = require('../AppSettings')
const UserSettings = require('../../user/UserSettings')
const ExtensionWatcher = require('../../ExtensionWatcher')

class BackendProcess {
  constructor () {
    this.dcAddress = process.env.SGCLOUD_DC_WS_ADDRESS || 'https://developer-connector.shopgate.cloud'
    this.socket = null
    this.extensionWatcher = new ExtensionWatcher()
  }

  connect (cb) {
    logger.info('Establishing SDK connection')
    this.socket = io(this.dcAddress, { extraHeaders: {
      Authorization: 'Bearer ' + UserSettings.getInstance().getSession().token
    }})

    this.socket.on('connect', () => {
      logger.info('SDK connection established')

      this.socket.emit('selectApplication', {applicationId: AppSettings.getInstance().getId()}, (err, data) => {
        if (err) return cb(err)

        logger.info(`Selected Application ${AppSettings.getInstance().getId()}`)

        this.extensionWatcher.registerAttach((data) => {
          logger.info(`Extension ${data} added`)

          this.socket.emit('registerExtension', data, () => {
            logger.info(`Extension ${data} attached`)
          })
        })

        this.extensionWatcher.registerDetach((data) => {
          logger.info(`Extension ${data} removed`)

          this.socket.emit('deregisterExtension', data, () => {
            logger.info(`Extension ${data} detached`)
          })
        })

        this.extensionWatcher.start()
        cb()
      })
    })

    this.socket.on('error', (err) => {
      logger.error(err)
      // TODO: Throw error? cb(err)?
    })

    // this.socket.on('stepCall', ...)
  }

  /**
   * TODO: This will be removed, as 'selectApplication' is not necessary anymore
   * @param {String} applicationId
   * @param cb
   */
  selectApplication (applicationId, cb) {
    if (!this.socket) return cb(new Error('Connection not established'))

    logger.info('Establishing application connection')
    this.socket.emit('selectApplication', {applicationId}, err => {
      if (err) return cb(err)
      logger.info('Application connection established')
      cb()
    })
  }

  disconnect (cb = () => {}) {
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
  }
}

module.exports = BackendProcess
