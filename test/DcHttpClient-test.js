const assert = require('assert')
const nock = require('nock')
const DcHttpClient = require('../lib/DcHttpClient')

describe('DcHttpClient', () => {
  let dcClient
  let userSettings
  let session

  beforeEach(() => {
    session = {getToken: () => {}}
    userSettings = {getSession: () => session}
    dcClient = new DcHttpClient(userSettings)
  })

  describe('getInfos', () => {
    const infoType = 'foobarInfoType'
    const appId = 'foobarAppId'
    const deviceId = 'foobarDeviceId'

    it('should get infos', (done) => {
      const data = {foo: {body: {bar: 'foobar'}}}
      const dcMock = nock(dcClient.dcAddress).get(`/applications/${appId}/${infoType}/${deviceId}`).reply(200, data)

      dcClient.getInfos(infoType, appId, deviceId, (err, body) => {
        assert.ifError(err)
        assert.deepEqual(body, data)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      const newToken = 'foobarTokenNew'
      const dcMock = nock(dcClient.dcAddress).get(`/applications/${appId}/${infoType}/${deviceId}`).reply(200, null, {'x-jwt': newToken})

      userSettings.save = () => {}
      let sessionToken
      session.setToken = (token) => {
        sessionToken = token
      }

      dcClient.getInfos(infoType, appId, deviceId, (err) => {
        assert.ifError(err)
        assert.equal(sessionToken, newToken)
        dcMock.done()
        done()
      })
    })

    it('should callback error on dc error', (done) => {
      const dcMock = nock(dcClient.dcAddress).get(`/applications/${appId}/${infoType}/${deviceId}`).reply(500)

      dcClient.getInfos(infoType, appId, deviceId, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })

  describe('getPipelines', () => {
    const appId = 'foobarAppId'

    it('should get a pipeline', (done) => {
      const body = {pipelines: ['foo', 'bar']}
      const dcMock = nock(dcClient.dcAddress).get(`/applications/${appId}/pipelines`).reply(200, body)

      dcClient.getPipelines(appId, (err, pipelines) => {
        assert.ifError(err)
        assert.deepEqual(pipelines, body.pipelines)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      const newToken = 'foobarTokenNew'
      const dcMock = nock(dcClient.dcAddress).get(`/applications/${appId}/pipelines`).reply(200, {}, {'x-jwt': newToken})

      userSettings.save = () => {}
      let sessionToken
      session.setToken = (token) => {
        sessionToken = token
      }

      dcClient.getPipelines(appId, (err) => {
        assert.ifError(err)
        assert.equal(sessionToken, newToken)
        dcMock.done()
        done()
      })
    })

    it('should callback error on dc-error', (done) => {
      const dcMock = nock(dcClient.dcAddress).get(`/applications/${appId}/pipelines`).reply(500)

      dcClient.getPipelines(appId, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })
  describe('updatePipeline', () => {
    it('should update a pipeline', (done) => {
      nock(dcClient.dcAddress)
        .put('/applications/shop_10006/pipelines/someId')
        .reply(204)

      dcClient.updatePipeline({pipeline: {id: 'someId'}}, 'shop_10006', (err) => {
        assert.ifError(err)
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      nock(dcClient.dcAddress)
        .put('/applications/shop_10006/pipelines/someId')
        .reply(204, {}, {'x-jwt': 'newToken'})

      userSettings.save = () => {}
      let sessionToken
      session.setToken = (token) => {
        sessionToken = token
      }

      dcClient.updatePipeline({pipeline: {id: 'someId'}}, 'shop_10006', (err) => {
        assert.ifError(err)
        assert.equal(sessionToken, 'newToken')
        done()
      })
    })

    it('should return an error on dc-error', (done) => {
      nock(dcClient.dcAddress)
        .put('/applications/shop_10006/pipelines/someId')
        .reply(500)

      dcClient.updatePipeline({pipeline: {id: 'someId'}}, 'shop_10006', (err) => {
        assert.ok(err)
        done()
      })
    })
  })

  describe('generateConfig', () => {
    const appId = 'foobarAppId'
    const extId = 'testExt'

    it('should get a config', (done) => {
      const body = {id: extId}
      const dcMock = nock(dcClient.dcAddress).post(`/applications/${appId}/extensions/${extId}/generateConfig`)
        .reply(200, body)

      dcClient.generateExtensionConfig({id: extId}, appId, (err, config) => {
        assert.ifError(err)
        assert.deepEqual(config, body)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      const newToken = 'foobarTokenNew'
      const dcMock = nock(dcClient.dcAddress).post(`/applications/${appId}/extensions/${extId}/generateConfig`)
        .reply(200, {}, {'x-jwt': newToken})

      userSettings.save = () => {}
      let sessionToken
      session.setToken = (token) => {
        sessionToken = token
      }

      dcClient.generateExtensionConfig({id: extId}, appId, (err) => {
        assert.ifError(err)
        assert.equal(sessionToken, newToken)
        dcMock.done()
        done()
      })
    })

    it('should callback error on dc-error', (done) => {
      const dcMock = nock(dcClient.dcAddress).post(`/applications/${appId}/extensions/${extId}/generateConfig`)
        .reply(500)

      dcClient.generateExtensionConfig({id: extId}, appId, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })

})
