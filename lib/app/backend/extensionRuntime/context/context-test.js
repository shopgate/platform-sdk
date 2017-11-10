const Context = require('./Context')
const AppSettings = require('../../../AppSettings')
const IcsProxy = require('./IcsProxy')
const Storage = require('./Storage')
const logger = require('../../../../logger')

module.exports = () => {
  const storage = new Storage(logger)
  const appId = AppSettings.getInstance().getId()
  const socket = {} // todo
  const config = {} // todo
  const extensionId = 'todo'
  const icsProxy = new IcsProxy(socket, appId)
  const meta = {
    appId,
    deviceId: 'todo',
    userId: 'todo'
  }

  return new Context(storage, icsProxy, config, extensionId, meta, logger)
}
