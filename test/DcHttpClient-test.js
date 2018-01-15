const assert = require('assert')
const nock = require('nock')
const DcHttpClient = require('../lib/DcHttpClient')
const UserSettings = require('../lib/user/UserSettings')
const path = require('path')
const fsEx = require('fs-extra')
const UnauthorizedError = require('../lib/errors/UnauthorizedError')

describe('DcHttpClient', () => {
  let dcClient

  before(() => {
    process.env.USER_PATH = path.join('build', 'usersettings')
    fsEx.emptyDirSync(process.env.USER_PATH)
  })

  after(() => {
    fsEx.removeSync(process.env.USER_PATH)
    delete process.env.USER_PATH
  })

  beforeEach(() => {
    dcClient = new DcHttpClient(new UserSettings().setToken({}), {debug: () => {}})
  })

  describe('getInfos', () => {
    const infoType = 'foobarInfoType'
    const appId = 'foobarAppId'
    const deviceId = 'foobarDeviceId'

    it('should get infos', (done) => {
      const data = {foo: {body: {bar: 'foobar'}}}
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/${infoType}/${deviceId}`)
        .reply(200, data)

      dcClient.getInfos(infoType, appId, deviceId, (err, body) => {
        assert.ifError(err)
        assert.deepEqual(body, data)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      const newToken = 'foobarTokenNew45662'
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/${infoType}/${deviceId}`)
        .reply(200, null, {'x-jwt': newToken})

      dcClient.getInfos(infoType, appId, deviceId, (err) => {
        assert.ifError(err)
        assert.equal(dcClient.userSettings.getToken(), newToken)
        dcMock.done()
        done()
      })
    })

    it('should callback error on dc error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/${infoType}/${deviceId}`)
        .reply(500)

      dcClient.getInfos(infoType, appId, deviceId, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })

  describe('downloadPipelines', () => {
    const appId = 'foobarAppId'

    it('should get a pipeline', (done) => {
      const body = {pipelines: ['foo', 'bar']}
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/pipelines`)
        .reply(200, body)

      dcClient.downloadPipelines(appId, false, (err, pipelines) => {
        assert.ifError(err)
        assert.deepEqual(pipelines, body.pipelines)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      const newToken = 'foobarTokenNew13456'
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/pipelines`)
        .reply(200, {}, {'x-jwt': newToken})

      dcClient.downloadPipelines(appId, false, (err) => {
        assert.ifError(err)
        assert.equal(dcClient.userSettings.getToken(), newToken)
        dcMock.done()
        done()
      })
    })

    it('should callback error on dc-error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}/pipelines`)
        .reply(500)

      dcClient.downloadPipelines(appId, false, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })

  describe('uploadPipeline', () => {
    it('should update a pipeline', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/pipelines/someId')
        .reply(204)

      dcClient.uploadPipeline({pipeline: {id: 'someId'}}, 'shop_10006', false, (err) => {
        assert.ifError(err)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      const newToken = 'newToken134'
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/pipelines/someId')
        .reply(204, {}, {'x-jwt': newToken})

      dcClient.uploadPipeline({pipeline: {id: 'someId'}}, 'shop_10006', false, (err) => {
        assert.ifError(err)
        assert.equal(dcClient.userSettings.getToken(), newToken)
        dcMock.done()
        done()
      })
    })

    it('should return an error on dc-error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/pipelines/someId')
        .reply(500)

      dcClient.uploadPipeline({pipeline: {id: 'someId'}}, 'shop_10006', false, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })

  describe('removePipeline', () => {
    it('should remove a pipeline', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .delete('/applications/shop_10006/pipelines/someId')
        .reply(204)

      dcClient.removePipeline('someId', 'shop_10006', false, (err) => {
        assert.ifError(err)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      const newToken = 'newToken4123'
      const dcMock = nock(dcClient.dcAddress)
        .delete('/applications/shop_10006/pipelines/someId')
        .reply(204, {}, {'x-jwt': newToken})

      dcClient.removePipeline('someId', 'shop_10006', false, (err) => {
        assert.ifError(err)
        assert.equal(dcClient.userSettings.getToken(), newToken)
        dcMock.done()
        done()
      })
    })

    it('should return an error on dc-error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .delete('/applications/shop_10006/pipelines/someId')
        .reply(500)

      dcClient.removePipeline('someId', 'shop_10006', false, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })

  describe('setStartPageUrl', () => {
    it('should set the start page url', (done) => {
      const startPageUrl = 'http://someurl'
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/settings/startpage', {startPageUrl})
        .reply(204)

      dcClient.setStartPageUrl('shop_10006', startPageUrl, (err) => {
        assert.ifError(err)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      const newToken = 'newToken341'
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/settings/startpage')
        .reply(204, {}, {'x-jwt': newToken})

      dcClient.setStartPageUrl('shop_10006', 'http://someurl', (err) => {
        assert.ifError(err)
        assert.equal(dcClient.userSettings.getToken(), newToken)
        dcMock.done()
        done()
      })
    })

    it('should return an error on dc-error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .put('/applications/shop_10006/settings/startpage')
        .reply(500)

      dcClient.setStartPageUrl('shop_10006', 'http://someurl', (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })

  describe('generateConfig', () => {
    const appId = 'foobarAppId'
    const extId = 'testExt'

    it('should get a config', (done) => {
      const body = {id: extId}
      const dcMock = nock(dcClient.dcAddress)
        .post(`/applications/${appId}/extensions/${extId}/generateConfig`)
        .reply(200, body)

      dcClient.generateExtensionConfig({id: extId}, appId, (err, config) => {
        assert.ifError(err)
        assert.deepEqual(config, body)
        dcMock.done()
        done()
      })
    })

    it('should update the usertoken on jwt-update', (done) => {
      const newToken = 'foobarTokenNew34'
      const dcMock = nock(dcClient.dcAddress)
        .post(`/applications/${appId}/extensions/${extId}/generateConfig`)
        .reply(200, {}, {'x-jwt': newToken})

      dcClient.generateExtensionConfig({id: extId}, appId, (err) => {
        assert.ifError(err)
        assert.equal(dcClient.userSettings.getToken(), newToken)
        dcMock.done()
        done()
      })
    })

    it('should callback error on dc-error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .post(`/applications/${appId}/extensions/${extId}/generateConfig`)
        .reply(500)

      dcClient.generateExtensionConfig({id: extId}, appId, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })

  describe('getApplicationData', () => {
    const appId = 'foobarAppId'

    it('should get application data', (done) => {
      const data = {foo: {body: {bar: 'foobar'}}}
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}`)
        .reply(200, data)

      dcClient.getApplicationData(appId, (err, body) => {
        assert.ifError(err)
        assert.deepEqual(body, data)
        dcMock.done()
        done()
      })
    })

    it('should callback unauthorized error on dc unauthorized error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}`)
        .reply(401, {message: 'Error!'})

      dcClient.getApplicationData(appId, (err) => {
        assert.ok(err)
        assert.ok(err instanceof UnauthorizedError, 'Error needs to be from type UnauthorizedError')
        dcMock.done()
        done()
      })
    })

    it('should callback error on dc error', (done) => {
      const dcMock = nock(dcClient.dcAddress)
        .get(`/applications/${appId}`)
        .reply(500)

      dcClient.getApplicationData(appId, (err) => {
        assert.ok(err)
        dcMock.done()
        done()
      })
    })
  })
})
