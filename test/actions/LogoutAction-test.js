const assert = require('assert')
const path = require('path')
const nock = require('nock')
const sinon = require('sinon')
const LogoutAction = require('../../lib/actions/LogoutAction')
const UserSettings = require('../../lib/user/UserSettings')
const settingsFolder = path.join('build', 'user')
const mockFs = require('mock-fs')
const fsEx = require('fs-extra')

describe('LogoutAction', () => {
  let userSettings
  let subjectUnderTest

  beforeEach(async () => {
    mockFs()
    process.env.USER_PATH = settingsFolder
    process.env.SGCLOUD_DC_ADDRESS = 'http://dc.shopgate.cloud'
    nock.disableNetConnect()
    process.env.SGCLOUD_USER = ''
    process.env.SGCLOUD_PASS = ''
    await fsEx.emptyDir(settingsFolder)
    userSettings = new UserSettings()
    subjectUnderTest = new LogoutAction(userSettings)
  })

  afterEach(async () => {
    delete process.env.USER_PATH
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.SGCLOUD_USER
    delete process.env.SGCLOUD_PASS
    nock.enableNetConnect()
    await fsEx.remove(settingsFolder)
    mockFs.restore()
  })

  it('should register', (done) => {
    LogoutAction.build({})
    const commander = {}
    commander.command = sinon.stub().returns(commander)
    commander.description = sinon.stub().returns(commander)
    commander.option = sinon.stub().returns(commander)
    commander.action = (cb) => {
      cb()
    }

    LogoutAction.build = () => {
      return {
        run: async () => (true)
      }
    }
    LogoutAction.register(commander, null, userSettings)

    assert(commander.command.calledWith('logout'))
    assert(commander.description.calledOnce)
    done()
  })

  it('should work even if logged out', async () => {
    try {
      await userSettings.getToken()
      assert.fail('Should not have gotten token')
    } catch (error) {
      await subjectUnderTest.run()
    }
  })

  it('should keep the username, but remove the token in the userSettings', async () => {
    await userSettings.setToken('token')
    await userSettings.setUsername('foo')

    assert.equal(await userSettings.getToken(), 'token')
    await subjectUnderTest.run()

    assert.equal(await userSettings.getUsername(), 'foo')

    try {
      assert.equal(await userSettings.getToken(), null)
      assert.fail()
    } catch (error) {
      assert.equal(true, true)
    }
  })
})
