const { SoftError } = require('../errors')
const logger = require('../logger')

module.exports = (err) => {
  if (!(err instanceof SoftError)) {
    if (err.code && err.message) {
      logger.error(`${err.message} (${err.code})`)
    } else if (err.stack) {
      err.stack = err.stack.split('\n').slice(0, 4).join('\n')
      logger.error(process.env.LOG_LEVEL !== 'debug' ? err.message : err)
    }
  }
  process.exit(1)
}
