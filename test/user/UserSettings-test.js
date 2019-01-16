const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const config = require('../../lib/config')
const UserSettings = require('../../lib/user/UserSettings')

describe('UserSettings', () => {
  let testFolder

  beforeEach(async () => {
    testFolder = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    config.load({ userDirectory: testFolder })
  })

  afterEach(async () => {
    await fsEx.remove(testFolder)
  })

  it('should return session loaded from file', async () => {
    const userSettings = new UserSettings()
    const session = {token: 'foo', user: 'bar'}
    await fsEx.ensureDir(userSettings.settingsFolder)
    await fsEx.writeJson(userSettings.sessionFile, {token: 'foo', user: 'bar'})

    assert.equal(session.token, await userSettings.getToken())
    assert.equal(session.user, await userSettings.getUsername())
  })

  it('should save all settings', async () => {
    const token = {foo: 'bar'}
    const user = 'foo@bar.baz'
    const userSettings = new UserSettings()
    await userSettings.setToken(token)
    await userSettings.setUsername(user)
    await userSettings.validate()

    assert.deepEqual(fsEx.readJsonSync(userSettings.sessionFile).token, token)
    assert.deepEqual(fsEx.readJsonSync(userSettings.sessionFile).user, user)
  })
})
