const path = require('path')
const fsEx = require('fs-extra')

const Logger = require('./Logger')
const Context = require('./context/Context')
const Storage = require('./context/Storage')
const MapStorage = require('./context/MapStorage')
const DcRequester = require('./context/DcRequester')
const AppSettings = require('../../AppSettings')
const errio = require('errio')
const utils = require('../../../utils/utils')

let appSettings
let storage
let mapStorage
let dcRequest
// @ts-ignore
/** @type any */
const logger = new Logger();

(async function () {
  const folder = await utils.getApplicationFolder()
  appSettings = await new AppSettings(folder).validate()
  const storagePath = process.env.STORAGE_PATH || path.join(appSettings.settingsFolder, 'storage.json')
  const mapStoragePath = process.env.MAP_STORAGE_PATH || path.join(appSettings.settingsFolder, 'map_storage.json')
  storage = new Storage(storagePath, logger)
  mapStorage = new MapStorage(mapStoragePath, logger)
  dcRequest = DcRequester.getInstance()
})().then(() => {
  process.on('message', (message) => {
    try {
      DcRequester.handleResponse(message)
    } catch (err) {
      logger.error('Error during step execution with message: ' + err.message)
    }
  })
  process.on('message',
    /**
     * @param {Object} message
     * @param {string} [message.type]
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
    async (message) => {
      if (message.type === 'dcResponse') {
        // see DcRequester.handleResponse() for handling of dcResponse type messages
        return
      }

      logger.sysInfo(`Starting step execution [id: ${message.stepMeta.id}, path: ${message.stepMeta.path}]`)

      const onUncaughtException = (err) => {
        logger.error(err.stack)
        sendOutput(err)
        return process.exit(1)
      }

      function sendOutput (err, output) {
        logger.sysInfo(`Step executed [id: ${message.stepMeta.id}, path: ${message.stepMeta.path}]`)
        if (err) {
          if (err.name === undefined || err.message === undefined) {
            const msg = `The step returned a non valid error object as error, make sure the object includes 'name' and 'message' properties`
            logger.error({ invalidError: err }, msg)
            err = new Error(msg)
          }
          err = errio.toObject(err)
        }
        process.send({ type: 'output', callId: message.callId, err, output })
        process.removeListener('uncaughtException', onUncaughtException)
        process.removeListener('unhandledRejection', onUncaughtException)
      }

      const attachedExtensions = await appSettings.loadAttachedExtensions()
      if (!attachedExtensions[message.stepMeta.id]) {
        return sendOutput(new Error(`Got step execution of unregistered extension: "${message.stepMeta.id}"`))
      }

      const extensionsPath = path.resolve(path.join(appSettings.settingsFolder, '..', 'extensions'))
      const absExtPath = path.join(extensionsPath, attachedExtensions[message.stepMeta.id].path, 'extension')
      const stepFile = path.join(absExtPath, message.stepMeta.path.substr(message.stepMeta.id.length))

      let config = {}
      try {
        config = await fsEx.readJson(path.join(absExtPath, 'config.json'), { throws: false }) || {}
      } catch (err) {
        logger.warn('No extension configuration found at ' + path.join(absExtPath, 'config.json'))
      }

      if (!await fsEx.pathExists(stepFile)) {
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

      const context = new Context(storage, mapStorage, config, dcRequest, message.stepMeta.id, message.stepMeta.meta, logger)

      let actionReturn = null
      let promiseThenFunc = (result) => sendOutput(null, result)
      let promiseErrorFunc = (err) => sendOutput(err)
      let callback = (err, result) => {
        promiseThenFunc = null
        promiseErrorFunc = null
        sendOutput(err, result)
      }

      if (!message.stepMeta.isErrorCatching) {
        actionReturn = action(context, message.input, callback)
      } else {
        actionReturn = action(message.stepMeta.catchableError, context, message.input, callback)
      }

      // This means that the step uses a promise instead of a callback
      if (actionReturn && typeof actionReturn.then === 'function') {
        callback = null
        actionReturn.then(promiseThenFunc).catch(promiseErrorFunc)
      }
    }
  )

  process.send({ ready: true })
})
