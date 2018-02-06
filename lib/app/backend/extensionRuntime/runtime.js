const path = require('path')
const fsEx = require('fs-extra')

const Logger = require('./Logger')
const Context = require('./context/Context')
const Storage = require('./context/Storage')
const DcHttpClient = require('../../../DcHttpClient')
const AppSettings = require('../../AppSettings')
const UserSettings = require('./../../../user/UserSettings')
const errio = require('errio')
const utils = require('../../../utils/utils')

let appSettings
let storage
const logger = new Logger();

(async function () {
  const folder = await utils.getApplicationFolder()
  appSettings = await new AppSettings(folder).validate()
  storage = new Storage(appSettings, logger)
})().then(() => {
  process.on('message',
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
    (message) => {
      logger.sysInfo(`Starting step execution ...`)

      const onUncaughtException = (err) => {
        logger.error(err.stack)
        sendOutput(err)
        return process.exit(1)
      }

      function sendOutput (err, output) {
        logger.sysInfo(`Step executed`)
        if (err) err = errio.toObject(err)
        process.send({type: 'output', callId: message.callId, err, output})
        process.removeListener('uncaughtException', onUncaughtException)
        process.removeListener('unhandledRejection', onUncaughtException)
      }

      const attachedExtensions = appSettings.loadAttachedExtensions()
      if (!attachedExtensions[message.stepMeta.id]) {
        return sendOutput(new Error(`Got step execution of unregistered extension: "${message.stepMeta.id}"`))
      }

      const extensionsPath = path.resolve(path.join(appSettings.settingsFolder, '..', 'extensions'))
      const userSettings = new UserSettings().validate() // re-init every time, maybe file changed
      const dcHttpClient = new DcHttpClient(userSettings)
      const absExtPath = path.join(extensionsPath, attachedExtensions[message.stepMeta.id].path, 'extension')
      const config = fsEx.readJSONSync(path.join(absExtPath, 'config.json'), {throws: false}) || {}
      const stepFile = path.join(absExtPath, message.stepMeta.path.substr(message.stepMeta.id.length))

      if (!fsEx.pathExistsSync(stepFile)) {
        const err = new Error(`StepFile ${stepFile} not found`)
        logger.error(err.message)
        return sendOutput(err)
      }

      process.on('uncaughtException', onUncaughtException)
      process.on('unhandledRejection', onUncaughtException)

      let action = null
      try {
        action = require(stepFile)
      } catch (err) {
        // When ecma script code is invalid
        logger.error(err.message)
        sendOutput(err)
        return process.exit(1)
      }

      if (typeof action !== 'function') {
        const err = new Error('Can\'t find step function; did you export a step function like \'module.exports = function ([error,] context, input, callback) {...}\'?')
        logger.error(err.message)
        sendOutput(err)
        return process.exit(1)
      }

      const context = new Context(storage, dcHttpClient, config, message.stepMeta.id, message.stepMeta.meta, logger)

      if (!message.stepMeta.isErrorCatching) return action(context, message.input, sendOutput)
      action(message.stepMeta.catchableError, context, message.input, sendOutput)
    }
  )

  process.send({ready: true})
})
