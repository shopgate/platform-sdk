const bunyan = require('bunyan')
const LogStream = require('./utils/logstream')
const osLocale = require('os-locale')

const streams = []

if (process.env.INTEGRATION_TEST === 'true') {
  streams.push({
    level: process.env.LOG_LEVEL || 'debug',
    stream: process.stdout
  })
} else {
  streams.push({
    level: process.env.LOG_LEVEL || 'info',
    stream: new LogStream(osLocale.sync().replace('_', '-')),
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
