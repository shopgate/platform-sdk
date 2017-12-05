const assert = require('assert')
const request = require('request')
const path = require('path')
const fsEx = require('fs-extra')
const nock = require('nock')

const CliProxy = require('../lib/app/backend/CliProxy')
const AppSettings = require('../lib/app/AppSettings')

const appPath = path.join('build', 'appsettings')

describe('CliProxy', () => {
  let cliProxy

  beforeEach(() => {
    cliProxy = new CliProxy()

    process.env.APP_PATH = appPath

    const appSettings = new AppSettings()
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId('foobarTest').setAttachedExtensions({}).save().init()
    AppSettings.setInstance(appSettings)

    nock.disableNetConnect()
  })

  afterEach((done) => {
    AppSettings.setInstance()
    delete process.env.APP_PATH
    nock.enableNetConnect()
    fsEx.remove(appPath, done)
  })

  describe('start()', () => {
    it('should run through', (done) => {
      cliProxy._getIdsFromRapid = (rapidUrl, shopNumber, cb) => cb(null, {sessionId: 0, deviceId: 0})
      cliProxy._startPipelineServer = (rapidPort, rapidUrl, sessionId, deviceId, shopNumber, cb) => cb()
      cliProxy.start(done)
    })

    it('should return an error', (done) => {
      cliProxy._getIdsFromRapid = (rapidUrl, shopNumber, cb) => cb(new Error())
      cliProxy._startPipelineServer = (rapidPort, rapidUrl, sessionId, deviceId, shopNumber, cb) => cb()
      cliProxy.start((err) => {
        assert.ok(err)
        done()
      })
    })
  })

  describe('_getIdsFromRapid()', () => {
    let returnObj = {
      cmds: [
        {p: {
          value: {}
        }}
      ]
    }

    let rapidUrl = 'http://localhost:1234'

    it('should run through', (done) => {
      const api = nock(rapidUrl)
        .post('/')
        .reply(200, returnObj, {
          'sg-device-id': 1
        })

      cliProxy._getIdsFromRapid(rapidUrl, 10006, (err) => {
        assert.ifError(err)
        api.done()
        done()
      })
    })

    it('should return error on missing body', (done) => {
      const api = nock(rapidUrl)
        .post('/')
        .reply(200, {}, {
          'sg-device-id': 1
        })

      cliProxy._getIdsFromRapid(rapidUrl, 10006, (err) => {
        assert.ok(err)
        api.done()
        done()
      })
    })

    it('should return error on missing header', (done) => {
      const api = nock(rapidUrl)
        .post('/')
        .reply(200, returnObj)

      cliProxy._getIdsFromRapid(rapidUrl, 10006, (err) => {
        assert.ok(err)
        api.done()
        done()
      })
    })
  })

  describe('_startPipelineServer()', () => {
    it('should start server', (done) => {
      cliProxy._startPipelineServer(1238, 'rapidUrl', 1, 1, 10006, (err, server) => {
        assert.ifError(err)
        server.close(done)
      })
    })
  })

  describe('_getPipelineHandlerFunction()', () => {
    it('should start server', (done) => {
      const port = 1251
      const result = {
        'cmds': [
          {
            'c': 'pipelineResponse',
            'p': {
              'output': {
                'someId': 1
              }
            }
          }
        ]
      }
      nock.enableNetConnect()

      const api = nock(`http://localhost:${port + 1}`)
        .post('/')
        .reply(200, result)

      cliProxy._startPipelineServer(port, `http://localhost:${port + 1}`, 1, 1, 10006, (err, server) => {
        assert.ifError(err)

        request({
          url: `http://localhost:${port}/pipelines/somePipeline`,
          method: 'POST',
          json: true
        }, (err, res, body) => {
          assert.ifError(err)
          assert.deepEqual(body, {someId: 1})
          api.done()
          nock.disableNetConnect()
          server.close(done)
        })
      })
    })

    it('should return error on rapid error', (done) => {
      const port = 1262
      const result = {message: 'Custom Error'}
      nock.enableNetConnect()

      const api = nock(`http://localhost:${port + 1}`)
        .post('/')
        .reply(403, result)

      cliProxy._startPipelineServer(port, `http://localhost:${port + 1}`, 1, 1, 10006, (err, server) => {
        assert.ifError(err)

        request({
          url: `http://localhost:${port}/pipelines/somePipeline`,
          method: 'POST',
          json: true
        }, (err, res, body) => {
          assert.ifError(err)
          assert.equal(res.statusCode, 403)
          assert.equal(body, 'Custom Error')
          api.done()
          nock.disableNetConnect()
          server.close(done)
        })
      })
    })

    it('should return error on plc error', (done) => {
      const port = 1262
      const result = {
        'cmds': [
          {
            'c': 'pipelineResponse',
            'p': {
              'error': {
                'message': 'SomeError'
              }
            }
          }
        ]
      }
      nock.enableNetConnect()

      const api = nock(`http://localhost:${port + 1}`)
        .post('/')
        .reply(200, result)

      cliProxy._startPipelineServer(port, `http://localhost:${port + 1}`, 1, 1, 10006, (err, server) => {
        assert.ifError(err)

        request({
          url: `http://localhost:${port}/pipelines/somePipeline`,
          method: 'POST',
          json: true
        }, (err, res, body) => {
          assert.ifError(err)
          assert.deepEqual(body, {'error': {'message': 'SomeError'}})
          api.done()
          nock.disableNetConnect()
          server.close(done)
        })
      })
    })
  })
})
