const assert = require('assert')
const sinon = require('sinon')
const request = require('request')
const path = require('path')
const fsEx = require('fs-extra')
const nock = require('nock')
const CliProxy = require('../lib/app/backend/CliProxy')
const AppSettings = require('../lib/app/AppSettings')
const mockFs = require('mock-fs')
describe('CliProxy', () => {

  before(done => {
    mockFs()
    done()
  })

  after(done => {
    mockFs.restore()
    done()
  })

  let cliProxy

  before(() => {
    process.env.APP_PATH = path.join('build', 'cli-test')
    return fsEx.emptyDir(process.env.APP_PATH)
  })

  beforeEach(async () => {
    cliProxy = new CliProxy(await new AppSettings(appPath).setId('foobarTest'), {info: () => {}})
    nock.disableNetConnect()
  })

  afterEach(async () => {
    nock.enableNetConnect()
    await cliProxy.close()
  })

  after(() => {
    return fsEx.remove(process.env.APP_PATH)
      .then(() => delete process.env.APP_PATH)
  })

  describe('start()', () => {
    it('should run through', () => {
      cliProxy._getIdsFromRapid = sinon.stub().resolves({sessionId: 0, deviceId: 0})
      cliProxy._startPipelineServer = sinon.stub().resolves()
      return cliProxy.start()
    })

    it('should return an error', () => {
      cliProxy._getIdsFromRapid = sinon.stub().rejects(new Error('error'))
      cliProxy._startPipelineServer = sinon.stub().resolves()

      return cliProxy.start().catch(err => {
        assert.ok(err)
        assert.equal(err.message, 'error')
      })
    })
  })

  describe('_getIdsFromRapid()', () => {
    let returnObj = {
      cmds: [
        {
          p: {
            value: {}
          }
        }
      ]
    }

    let rapidUrl = 'http://localhost:1234'

    it('should run through', () => {
      const api = nock(rapidUrl)
        .post('/')
        .reply(200, returnObj, {
          'sg-device-id': 1
        })

      return cliProxy._getIdsFromRapid(rapidUrl, 10006).then(() => { api.done() })
    })

    it('should return error on missing body', () => {
      const api = nock(rapidUrl)
        .post('/')
        .reply(200, {}, {
          'sg-device-id': 1
        })

      cliProxy._getIdsFromRapid(rapidUrl, 10006).catch(err => {
        assert.ok(err)
        api.done()
      })
    })

    it('should return error on missing header', () => {
      const api = nock(rapidUrl)
        .post('/')
        .reply(200, returnObj)

      return cliProxy._getIdsFromRapid(rapidUrl, 10006).catch(err => {
        assert.ok(err)
        api.done()
      })
    })
  })

  describe('_startPipelineServer()', () => {
    it('should start server', () => {
      return cliProxy._startPipelineServer(1238, 'rapidUrl', 1, 1, 10006).then(server => {
        assert.ok(server)
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

      cliProxy._startPipelineServer(port, `http://localhost:${port + 1}`, 1, 1, 10006).then(server => {
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

    it('should return HTTP error on rapid error', (done) => {
      const port = 1262
      const result = {message: 'Custom Error'}
      nock.enableNetConnect()

      const api = nock(`http://localhost:${port + 1}`)
        .post('/')
        .reply(403, result)

      cliProxy._startPipelineServer(port, `http://localhost:${port + 1}`, 1, 1, 10006).then(() => {
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
          done()
        })
      })
    })

    it('should return HTTP error on plc error', (done) => {
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

      cliProxy._startPipelineServer(port, `http://localhost:${port + 1}`, 1, 1, 10006).then(server => {
        request({
          url: `http://localhost:${port}/pipelines/somePipeline`,
          method: 'POST',
          json: true
        }, (err, res, body) => {
          assert.ifError(err)
          assert.deepEqual(body, {'error': {'message': 'SomeError'}})
          api.done()
          nock.disableNetConnect()
          done()
        })
      })
    })
  })
})
