const bunyan = require('bunyan')
const LogStream = require('./utils/logstream')
const getLocale = require('./utils/locale')

const streams = []

if (process.env.INTEGRATION_TEST === 'true') {
  streams.push({
    level: process.env.LOG_LEVEL || 'debug',
    stream: process.stdout
  })
} else {
  streams.push({
    level: process.env.LOG_LEVEL || 'info',
    stream: new LogStream(getLocale()),
    type: 'raw'
  })
}

/**
 * @type {Logger}
 */
const logger = bunyan.createLogger({
  name: '\u0008',
  streams
})
logger.plain = console.log

module.exports = logger
