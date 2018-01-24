'use strict'

const path = require('path')
const glob = require('glob')
const logger = require('./lib/logger')
const actionFiles = glob.sync('./lib/actions/*.js', {cwd: __dirname, strict: true})

actionFiles.forEach((actionFile) => {
  module.exports[path.basename(actionFile).split('.')[0].split('Action')[0]] = require(actionFile)
})

function formatException (err) {
  if (err.code && err.message) return logger.error(`${err.message} (${err.code})`)
  if (err.stack) err.stack = err.stack.split('\n').slice(0, 4).join('\n')
  logger.error(process.env.LOG_LEVEL !== 'debug' ? err.message : err)
}

process.on('unhandledRejection', function (err) {
  formatException(err)
  process.exit(1)
})

process.on('uncaughtException', function (err) {
  formatException(err)
  process.exit(1)
})
