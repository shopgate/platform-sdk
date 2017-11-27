const path = require('path')
const fs = require('fs-extra')

const Logger = require('./Logger')
const Context = require('./context/Context')
const Storage = require('./context/Storage')
const DcHttpClient = require('../../../DcHttpClient')
const AppSettings = require('../../AppSettings')
const UserSettings = require('./../../../user/UserSettings')

const logger = new Logger()
const storage = new Storage(logger)

process.on('message', onMessage)
setTimeout(() => process.send({type: 'ready'}), 500)

/**
 * @param {Object} message
 * @param {Object} message.input
 * @param {String|Number} message.callId - for callback finding in StepExecutor
 * @param {Object} message.stepMeta
 * @param {String} message.stepMeta.id   - @organisation/extension
 * @param {String} message.stepMeta.path - @organisation/extension/folder/file.js
 * @param {Boolean} message.stepMeta.isErrorCatching
 * @param {Error} [message.stepMeta.catchableError]
 * @param {Object} message.stepMeta.meta
 * @param {String} message.stepMeta.meta.appId
 * @param {String} message.stepMeta.meta.deviceId
 * @param {String} [message.stepMeta.meta.userId]
 */
function onMessage (message) {
  logger.info('Starting step execution of %s', message.stepMeta.path)

  function output (err, output) {
    logger.info('Step execution of %s done', message.stepMeta.path)
    if (err) err = {message: err.message, stack: err.stack}
    process.send({type: 'output', callId: message.callId, err, output})
  }

  const appSettings = new AppSettings().init() // re-init every time, maybe file changed
  if (!appSettings.attachedExtensions[message.stepMeta.id]) {
    return output(new Error(`got step execution of unregistered extension: "${message.stepMeta.id}"`))
  }

  const extensionsPath = path.resolve(path.join(appSettings.settingsFolder, '..', 'extensions'))
  const userSettings = new UserSettings().init() // re-init every time, maybe file changed
  const dcHttpClient = new DcHttpClient(userSettings)
  const absExtPath = path.join(extensionsPath, appSettings.attachedExtensions[message.stepMeta.id].path, 'extension')
  const config = fs.readJSONSync(path.join(absExtPath, 'config.json'), {throws: false}) || {}
  const stepFile = path.join(absExtPath, message.stepMeta.path.substr(message.stepMeta.id.length))

  if (!fs.existsSync(stepFile)) return output(new Error(`StepFile "${stepFile}" not found`))

  const action = require(stepFile)
  const context = new Context(storage, dcHttpClient, config, message.stepMeta.id, message.stepMeta.meta, logger)

  if (!message.stepMeta.isErrorCatching) return action(context, message.input, output)
  action(message.stepMeta.catchableError, context, message.input, output)
}
