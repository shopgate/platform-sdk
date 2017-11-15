const assert = require('assert')
const Context = require('../../../../../lib/app/backend/extensionRuntime/context/Context')
const fsExtra = require('fs-extra')
const path = require('path')
const request = require('request')

describe('Context', () => {
  it('should have meta', () => {
    const meta = {foo: {bar: {}}}
    const context = new Context(null, null, null, null, meta)
    assert.deepEqual(context.meta, meta)
  })

  it('should have config', () => {
    const config = {foo: {bar: {}}}
    const context = new Context(null, null, config, null, {})
    assert.deepEqual(context.config, config)
  })

  it('should have log', () => {
    const log = {}
    const context = new Context(null, null, null, null, {}, log)
    assert.equal(context.log, log)
  })

  describe('storageInterfaces', () => {
    it('should have storageInterfaces', () => {
      const context = new Context(null, null, null, null, {})
      const storageInterfaceNames = ['extension', 'device', 'user']
      const storageInterfaceFunctionNames = ['get', 'set', 'del']
      assert.deepEqual(Object.keys(context.storage), storageInterfaceNames)
      storageInterfaceNames.forEach((storageInterfaceName) => {
        assert.deepEqual(Object.keys(context.storage[storageInterfaceName]), storageInterfaceFunctionNames)
      })
    })

    fsExtra.readJsonSync(path.join(__dirname, 'storageTests.json')).forEach((test) => {
      it('should ' + test.should, (done) => {
        const storage = {}
        storage[test.method] = (path, value, cb) => {
          assert.equal(path, test.path)
          switch (test.method) {
            case 'get':
              return value(null, test.value)
            case 'set':
              assert.equal(value, test.value)
              return cb()
            case 'del':
              return value()
          }
        }

        const context = new Context(storage, null, null, test.extensionId, test.meta || {})
        function doneCb (err, value) {
          if (!test.err) {
            assert.equal(value, test.method === 'get' ? test.value : undefined)
            return done(err)
          }
          assert.equal(err.message, test.err)
          assert.equal(value, undefined)
          done()
        }
        context.storage[test.type][test.method](test.key, test.method === 'set' ? test.value : doneCb, doneCb)
      })
    })
  })

  it('should have settings', (done) => {
    const settingsKey = 'settingsValue'
    const settingsValue = 'settingsValue'
    const extensionId = 'settings.extension.get'
    const appId = 'settingsAppIdGet'
    const storage = {get: (path, cb) => {
      assert.equal(path, `${appId}/${extensionId}/settings/${settingsKey}`)
      cb(null, settingsValue)
    }}

    const context = new Context(storage, null, null, extensionId, {appId})
    assert.deepEqual(Object.keys(context.settings), ['get'])

    context.settings.get(settingsKey, (err, value) => {
      assert.ifError(err)
      assert.equal(value, settingsValue)
      done()
    })
  })

  it('should have app info', (done) => {
    const meta = {deviceId: 'foobarDeviceId'}
    const ics = {getInfos: (infoType, deviceId, cb) => {
      assert.equal(infoType, 'appinfos')
      assert.equal(deviceId, meta.deviceId)
      cb()
    }}
    const context = new Context(null, ics, null, null, meta)
    assert.equal(Object.keys(context.app), 'getInfo')
    context.app.getInfo(done)
  })

  it('should have device info', (done) => {
    const meta = {deviceId: 'foobarDeviceId'}
    const ics = {getInfos: (infoType, deviceId, cb) => {
      assert.equal(infoType, 'deviceinfos')
      assert.equal(deviceId, meta.deviceId)
      cb()
    }}
    const context = new Context(null, ics, null, null, meta)
    assert.equal(Object.keys(context.device), 'getInfo')
    context.device.getInfo(done)
  })

  it('should have tracedRequest', () => {
    const context = new Context(null, null, null, null, {})
    assert.equal(typeof context.tracedRequest, 'function')
    assert.equal(context.tracedRequest(), request)
  })
})
