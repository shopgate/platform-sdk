const path = require('path')
const { readdirSync } = require('node:fs')
const exceptionHandler = require('./lib/utils/exceptionHandler')

// Plain readdir rather than fs.globSync: the pattern is a single flat directory, and globSync would
// raise the required node version to 22 for no gain.
const actionFiles = readdirSync(path.join(__dirname, 'lib', 'actions'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => path.join('lib', 'actions', file))

actionFiles.forEach((actionFile) => {
  module.exports[path.basename(actionFile).split('.')[0].split('Action')[0]] = require(path.resolve(__dirname, actionFile))
})

process.on('unhandledRejection', exceptionHandler)
process.on('uncaughtException', exceptionHandler)
