const assert = require('assert')
const path = require('path')
const nock = require('nock')
const sinon = require('sinon')
const LogoutAction = require('../../lib/actions/LogoutAction')
const UserSettings = require('../../lib/user/UserSettings')
const settingsFolder = path.join('build', 'user')
const fsEx = require('fs-extra')

describe('LogoutAction', () => {
  let userSettings

  beforeEach(async () => {
    process.env.USER_PATH = settingsFolder
    process.env.SGCLOUD_DC_ADDRESS = 'http://dc.shopgate.cloud'
    nock.disableNetConnect()
    process.env.SGCLOUD_USER = ''
    process.env.SGCLOUD_PASS = ''
    await fsEx.emptyDir(settingsFolder)
    userSettings = new UserSettings()
  })

  afterEach(async () => {
    delete process.env.USER_PATH
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.SGCLOUD_USER
    delete process.env.SGCLOUD_PASS
    nock.enableNetConnect()
    await fsEx.remove(settingsFolder)
  })

  it('should register', (done) => {
    const commander = {}
    commander.command = sinon.stub().returns(commander)
    commander.description = sinon.stub().returns(commander)
    commander.option = sinon.stub().returns(commander)
    commander.action = sinon.stub().returns(commander)

    LogoutAction.register(commander)

    assert(commander.command.calledWith('logout'))
    assert(commander.description.calledOnce)
    assert(commander.action.calledOnce)
    done()
  })

  it('should work even if logged out', async () => {
    try {
      await userSettings.getToken()
      assert.fail('Should not have gotten token')
    } catch (error) {
      const logout = new LogoutAction()
      await logout.run()
    }
  })

  it('should keep the username, but remove the token in the userSettings', async () => {
    await userSettings.setToken('token')
    await userSettings.setUsername('foo')

    assert.equal(await userSettings.getToken(), 'token')
    const logout = new LogoutAction()
    await logout.run()

    assert.equal(await userSettings.getUsername(), 'foo')

    try {
      assert.equal(await userSettings.getToken(), null)
      assert.fail()
    } catch (error) {
      assert.equal(true, true)
    }
  })
})
