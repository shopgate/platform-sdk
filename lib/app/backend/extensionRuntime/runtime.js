const path = require('path')
const decache = require('decache')
const fs = require('fs-extra')

const Logger = require('./Logger')
const Context = require('./context/Context')
const Storage = require('./context/Storage')
const DcHttpClient = require('../../../DcHttpClient')
const AppSettings = require('../../AppSettings')
const UserSettings = require('./../../../user/UserSettings')

const logger = new Logger()
const storage = new Storage(logger)
const extensionsPath = path.join(process.cwd(), 'extensions')

process.on('message', message => {
  // message.stepMeta.id:   '@shopgate/products'
  // message.stepMeta.path: '@shopgate/products/categories/getRootCategories.js'

  logger.info('Starting step execution of %s', message.stepMeta.path)

  const appSettings = new AppSettings().init() // re-init every time, maybe file changed
  if (!appSettings.attachedExtensions[message.stepMeta.id]) {
    return output(new Error(`got step execution of unregistered extension: "${message.stepMeta.id}"`))
  }

  const userSettings = new UserSettings().init() // re-init every time, maybe file changed
  const dcHttpClient = new DcHttpClient(userSettings) // TODO: address of ics inside dc is wrong maybe? we get a timeout
  const absExtPath = path.join(extensionsPath, appSettings.attachedExtensions[message.stepMeta.id].path, 'extension')
  const config = fs.readJSONSync(path.join(absExtPath, 'config.json'), {throw: false}) || {}
  const stepFile = path.join(absExtPath, message.stepMeta.path.substr(message.stepMeta.id.length))

  let action
  try {
    decache(stepFile)
    action = require(stepFile)
  } catch (e) {
    return output(e)
  }

  const context = new Context(storage, dcHttpClient, config, message.stepMeta.id, message.stepMeta.meta, logger)

  if (message.stepMeta.isErrorCatching) {
    return action(message.stepMeta.catchableError, context, message.input, output)
  }
  action(context, message.input, output)

  function output (err, output) {
    logger.info('Step execution of %s done', message.stepMeta.path)
    if (err) err = {message: err.message, stack: err.stack}
    process.send({type: 'output', callId: message.callId, err, output}) // do we need to do this with the err??
  }
})

process.on('SIGINT', () => process.exit(0))
