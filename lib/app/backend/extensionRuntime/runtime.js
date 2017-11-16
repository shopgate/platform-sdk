// const path = require('path')
// const decache = require('decache')
// const fs = require('fs-extra')

// const Context = require('./context/Context')
// const Logger = require('./Logger')
// const Storage = require('./context/Storage')
// const DCHttpClient = require('../../DCHttpClient')
// const AppSettings = require('../AppSettings')

// const logger = new Logger()
// const storage = new Storage(logger)
// const dcHttpClient = new DCHttpClient(logger) // TODO: what about UserSettings / JWT?
// const extensionsPath = path.join(process.cwd(), 'extensions')

process.on('message', message => {
  console.log(message)

  // logger.debug({stepMeta: message.stepMeta}, 'Starting step execution')
  // logger.trace({input: message.input}, 'Step input']})
  process.send({type: 'log', level: 'debug', arguments: [{stepMeta: message.stepMeta}, 'Starting step execution']})
  process.send({type: 'log', level: 'trace', arguments: [{input: message.input}, 'Step input']})

  // const absExtPath = path.join(extensionsPath, AppSettings.attachedExtensions[message.stepMeta.id].path)
  // const config = fs.readJSONSync(path.join(absExtPath, 'config.json') // TODO: error handling or fallback to {}?
  // const stepFile = path.join(absExtPath, message.stepMeta.path)
  // decache(stepFile)
  // const action = require(stepFile) // TODO: error handling?

  // const context = new Context(storage, dcHttpClient, config, message.stepMeta.id, message.stepMeta.meta, logger)

  const context = {}
  const action = function (err, input, context, cb) {
    if (!cb) {
      context = input
      input = err
    }
    cb(null, input)
  }

  if (message.stepMeta.isErrorCatching) {
    return action(message.stepMeta.catchableError, message.input, context, (err, output) => {
      process.send({type: 'output', callId: message.callId, err, output})
    })
  }

  action(message.input, context, (err, output) => {
    process.send({type: 'output', callId: message.callId, err, output})
  })
})

process.on('SIGINT', () => process.exit(0))
