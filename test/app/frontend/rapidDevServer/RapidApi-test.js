const assert = require('assert')
const proxyquire = require('proxyquire')

const request = {}
const logger = {
  plain: () => (true)
}

const RapidApi = proxyquire('../../../../lib/app/frontend/rapidDevServer/RapidApi', {
  '../../../logger': logger,
  request: request
})

describe('RapidApi', () => {
  describe('constructor()', () => {
    it('should save settings', () => {
      const api = new RapidApi('url', '123')
      assert.ok(api.settings.url === 'url')
      assert.ok(api.settings.shopNumber === '123')
    })
  })
  describe('init', () => {
    it('should throw an error if it cannot get app id', () => {
      request.post = () => {
        throw new Error()
      }
      const api = new RapidApi('url', '123')
      try {
        api.init(() => {
          assert.fail()
        })
      } catch (err) {
        assert.ok(err)
      }
    })
    it('should get the ids', () => {
      request.post = (params, callback) => {
        const res = {
          headers: {
            'sg-device-id': 'deviceId'
          }
        }
        const body = {
          cmds: [
            {
              p: {value: 'sessionId'}
            }
          ]
        }
        callback(null, res, body)
      }

      const api = new RapidApi('url', '123')
      try {
        api.init(() => {
          assert.deepEqual(api.settings, {
            url: 'url',
            shopNumber: '123',
            sessionId: 'sessionId',
            deviceId: 'deviceId'
          })
        })
      } catch (err) {
        assert.fail(err)
      }
    })
  })
  describe('handle', () => {
    it('should set the version, transform sendPipelineRequest to pipelineRequest', (done) => {
      request.post = (params, callback) => {
        const res = {
          headers: {
            'sg-device-id': 'deviceId'
          },
          statusCode: 200
        }
        const body = {
          cmds: [
            {
              c: 'pipelineRequest'
            }
          ]
        }
        let cmp = {
          vars: {sid: 'sessionId'},
          ver: '9.0'
        }
        Object.assign(cmp, body)
        assert.deepEqual(params.body, cmp)
        callback(null, res, body)
      }

      const res = {
        json: (check) => {
          res.send(check)
        },
        status: (code) => (res),
        send: (msg) => {
          done()
        }
      }
      const req = {
        body: {
          cmds: [
            {c: 'sendPipelineRequest'}
          ]
        }
      }
      const api = new RapidApi('url', '123')
      api.settings = {
        url: 'url',
        shopNumber: '123',
        sessionId: 'sessionId',
        deviceId: 'deviceId'
      }
      api.handle(req, res)
    })

    it('should set the statusCode and errorMsg', (done) => {
      request.post = (params, callback) => {
        const res = {
          headers: {
            'sg-device-id': 'deviceId'
          },
          statusCode: 500
        }
        const body = {
          message: 'Some Message'
        }
        callback(null, res, body)
      }

      const res = {
        json: (check) => {
          res.send(check)
        },
        status: (code) => (res),
        send: (msg) => {
          done()
        }
      }
      const req = {
        body: {
          cmds: [
            {c: 'sendPipelineRequest'}
          ]
        }
      }
      const api = new RapidApi('url', '123')
      api.settings = {
        url: 'url',
        shopNumber: '123',
        sessionId: 'sessionId',
        deviceId: 'deviceId'
      }
      api.handle(req, res)
    })

    it('should send 500 if it cannot connect', (done) => {
      request.post = (params, callback) => {
        let error = {message: 'cannot connect'}
        callback(error, null, null)
      }

      const res = {
        json: (check) => {
          res.send(check)
        },
        status: (code) => {
          assert.equal(code, 500)
          return res
        },
        send: (msg) => {
          assert.equal(msg, 'Could not connect to RAPID. Please try again later.')
          done()
        }
      }
      const req = {
        body: {
          cmds: [
            {c: 'sendPipelineRequest'}
          ]
        }
      }
      const api = new RapidApi('url', '123')
      api.settings = {
        url: 'url',
        shopNumber: '123',
        sessionId: 'sessionId',
        deviceId: 'deviceId'
      }
      api.handle(req, res)
    })
  })
})
