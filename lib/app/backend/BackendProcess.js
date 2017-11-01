const io = require('socket.io-client')
const logger = require('../../logger')

class BackendProcess {
  constructor () {
    this.dcAddress = process.env.SGCLOUD_DC_WS_ADDRESS || 'https://dc.shopgate.io:3000'
    this.socket = null
  }

  connect (cb) {
    logger.info('Establishing SDK connection')
    this.socket = io(this.dcAddress)

    this.socket.on('connect', () => {
      logger.info('SDK connection established')
      cb()
    })

    // this.socket.on('stepCall', ...)
    // this.socket.on('error', ...)
  }

  /**
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

  disconnect () {
    if (this.socket) this.socket.disconnect()
  }
}

module.exports = BackendProcess
