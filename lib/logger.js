const bunyan = require('bunyan')
const LogStream = require('./utils/logstream')
const osLocale = require('os-locale')

/**
 * @type {{trace:Function, debug:Function, info:Function, warn:Function, error:Function, child:Function, level:Function, levels:Function}}
 */
const logger = bunyan.createLogger({
  name: '\u0008',
  streams: [
    {
      level: process.env.LOG_LEVEL || 'info',
      stream: new LogStream(osLocale.sync().replace('_', '-')),
      type: 'raw'
    }
  ]
})
logger.plain = console.log

module.exports = logger
