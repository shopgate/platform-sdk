const io = require('socket.io-client')
const async = require('neo-async')
const logger = require('../../logger')
const AppSettings = require('../AppSettings')
const UserSettings = require('../../user/UserSettings')
const ExtensionWatcher = require('../../ExtensionWatcher')

class BackendProcess {
  constructor () {
    this.dcAddress = process.env.SGCLOUD_DC_ADDRESS || 'https://developer-connector.shopgate.cloud'
    this.socket = null
    this.extensionWatcher = new ExtensionWatcher()
  }

  connect (cb) {
    logger.info('Establishing SDK connection')

    const extraHeaders = {
      Authorization: 'Bearer ' + UserSettings.getInstance().getSession().getToken()
    }

    this.socket = io(this.dcAddress, {extraHeaders})
    this.socket.on('connect', () => {
      logger.info('SDK connection established')

      this.socket.emit('selectApplication', {applicationId: AppSettings.getInstance().getId()}, (err) => {
        if (err) return cb(err)

        logger.info(`Selected Application ${AppSettings.getInstance().getId()}`)

        this.extensionWatcher.on('attach', (extension) => {
          logger.info(`Extension ${extension} added`)

          this.socket.emit('registerExtension', extension, () => {
            logger.info(`Extension ${extension} attached`)
          })
        })

        this.extensionWatcher.on('detach', (extension) => {
          logger.info(`Extension ${extension} removed`)

          this.socket.emit('deregisterExtension', extension, () => {
            logger.info(`Extension ${extension} detached`)
          })
        })

        this.extensionWatcher.start()
        cb()
      })
    })

    this.socket.on('connect_error', (err) => {
      throw new Error(`Connection to SG-Cloud failed: ${err}`)
    })

    this.socket.on('error', (err) => {
      logger.error(err)
    })

    // this.socket.on('stepCall', ...)
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
