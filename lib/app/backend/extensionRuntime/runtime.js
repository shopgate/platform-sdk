const path = require('path')
const decache = require('decache')
const fs = require('fs-extra')

// const Logger = require('./Logger')
// const Context = require('./context/Context')
// const Storage = require('./context/Storage')
// const DcHttpClient = require('../../../DcHttpClient')
const AppSettings = require('../../AppSettings')

// const logger = new Logger()
// const storage = new Storage(logger)
// const dcHttpClient = new DcHttpClient(logger) // TODO: what about UserSettings / JWT?
const extensionsPath = path.join(process.cwd(), 'extensions')

process.on('message', message => {
  // message.stepMeta.id:   '@shopgate/products'
  // message.stepMeta.path: '@shopgate/products/categories/getRootCategories.js'

  // logger.debug({stepMeta: message.stepMeta}, 'Starting step execution')
  process.send({type: 'log', level: 'debug', arguments: ['Starting step execution of %s', message.stepMeta.path]})

  const appSettings = new AppSettings().init() // re-init every time, maybe file changed
  if (!appSettings.attachedExtensions[message.stepMeta.id]) {
    return output(new Error(`got step execution of unregistered extension: "${message.stepMeta.id}"`))
  }

  const absExtPath = path.join(extensionsPath, appSettings.attachedExtensions[message.stepMeta.id].path, 'extension')
  const config = fs.readJSONSync(path.join(absExtPath, 'config.json'), {throw: false}) || {} // TODO: error handling/throwing or fallback to {}?
  const stepFile = path.join(absExtPath, message.stepMeta.path.substr(message.stepMeta.id.length))

  let action
  try {
    decache(stepFile)
    action = require(stepFile)
  } catch (e) {
    return output(e)
  }

  // const context = new Context(storage, dcHttpClient, config, message.stepMeta.id, message.stepMeta.meta, logger)

  const context = {
    meta: {appId: 'shop_30685'},
    config
  }

  if (message.stepMeta.isErrorCatching) {
    return action(message.stepMeta.catchableError, context, message.input, output)
  }
  action(context, message.input, output)

  function output (err, output) {
    // logger.debug('Step execution of %s done', message.stepMeta.path)
    process.send({type: 'log', level: 'debug', arguments: ['Step execution of %s done', message.stepMeta.path]})
    process.send({type: 'output', callId: message.callId, err, output})
  }
})

process.on('SIGINT', () => process.exit(0))
