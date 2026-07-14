const path = require('path')
const { globSync } = require('node:fs')
const exceptionHandler = require('./lib/utils/exceptionHandler')

const actionFiles = globSync('./lib/actions/*.js', { cwd: __dirname })

actionFiles.forEach((actionFile) => {
  module.exports[path.basename(actionFile).split('.')[0].split('Action')[0]] = require(path.resolve(__dirname, actionFile))
})

process.on('unhandledRejection', exceptionHandler)
process.on('uncaughtException', exceptionHandler)
