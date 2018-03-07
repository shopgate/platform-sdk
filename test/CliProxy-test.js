require('longjohn')
const assert = require('assert')
const request = require('request')

const nock = require('nock')
const CliProxy = require('../lib/app/backend/CliProxy')

describe('CliProxy', () => {
  let cliProxy
  const appSettings = {
    validate: () => (this),
    getId: async () => ('shop_123')
  }

  beforeEach(async () => {
    cliProxy = new CliProxy(appSettings, { info: () => { } })
  })

  afterEach(async () => {
    return cliProxy.close()
  })
  after(async () => {
    return delete process.env.APP_PATH
  })

  describe('start()', () => {
    it('should run through', async () => {
      cliProxy._getIdsFromRapid = async () => ({
        sessionId: 'sessionId',
        deviceId: 'deviceId'
      })
      cliProxy._startPipelineServer = async () => (true)
      return cliProxy.start()
    })

    it('should return an error', () => {
      cliProxy._getIdsFromRapid = async () => {
        throw new Error('error')
      }
      cliProxy._startPipelineServer = async () => (true)

      return cliProxy.start().catch(err => {
        assert.ok(err)
        assert.equal(err.message, 'error')
        return cliProxy.close()
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

    it('should run through', (done) => {
      const api = nock(rapidUrl)
        .post('/')
        .reply(200, returnObj, {
          'sg-device-id': 1
        })

      cliProxy._getIdsFromRapid(rapidUrl, 10006).then(() => { api.done(); done() })
    })

    it('should return error on missing body', (done) => {
      const api = nock(rapidUrl)
        .post('/')
        .reply(200, {}, {
          'sg-device-id': 1
        })

      cliProxy._getIdsFromRapid(rapidUrl, 10006).catch(err => {
        assert.ok(err)
        api.done()
        done()
      })
    })

    it('should return error on missing header', (done) => {
      const api = nock(rapidUrl)
        .post('/')
        .reply(200, returnObj)

      cliProxy._getIdsFromRapid(rapidUrl, 10006).catch(err => {
        assert.ok(err)
        api.done()
        done()
      })
    })
  })

  describe('_startPipelineServer()', () => {
    it('should start server', (done) => {
      cliProxy._startPipelineServer(1238, 'rapidUrl', 1, 1, 10006).then(server => {
        assert.ok(server)
        done()
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
          assert.deepEqual(body, { someId: 1 })
          api.done()
          nock.disableNetConnect()
          cliProxy.close().then(() => {
            server.close(done)
          })
        })
      })
    })

    it('should return HTTP error on rapid error', (done) => {
      const port = 1262
      const result = { message: 'Custom Error' }
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
          cliProxy.close().then(() => {
            done()
          })
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
          assert.deepEqual(body, { 'error': { 'message': 'SomeError' } })
          api.done()
          cliProxy.close().then(() => {
            nock.disableNetConnect()
            done()
          })
        })
      })
    })
  })
})
