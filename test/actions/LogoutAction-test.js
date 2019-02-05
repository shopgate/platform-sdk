const assert = require('assert')
const fsEx = require('fs-extra')
const nock = require('nock')
const os = require('os')
const path = require('path')
const sinon = require('sinon')
const { promisify } = require('util')
const LogoutAction = require('../../lib/actions/LogoutAction')
const config = require('../../lib/config')
const UserSettings = require('../../lib/user/UserSettings')

describe('LogoutAction', () => {
  let settingsFolder
  let userSettings
  let subjectUnderTest

  before(async () => {
    settingsFolder = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    config.load({ userDirectory: settingsFolder })
  })

  beforeEach(async () => {
    process.env.SGCLOUD_DC_ADDRESS = 'http://dc.shopgate.cloud'
    nock.disableNetConnect()
    process.env.SGCLOUD_USER = ''
    process.env.SGCLOUD_PASS = ''
    await fsEx.emptyDir(settingsFolder)
    userSettings = new UserSettings()
    subjectUnderTest = new LogoutAction(userSettings)
  })

  afterEach(async () => {
    delete process.env.USER_DIR
    delete process.env.SGCLOUD_DC_ADDRESS
    delete process.env.SGCLOUD_USER
    delete process.env.SGCLOUD_PASS
    nock.enableNetConnect()
    await fsEx.emptyDir(settingsFolder)
  })

  after(async () => fsEx.remove(settingsFolder))

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
