const UserSettings = require('../../lib/user/UserSettings')
const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')

describe('UserSettings', () => {
  let testFolder

  beforeEach(() => {
    testFolder = path.join('build', 'usersettings')
    process.env.USER_PATH = testFolder
  })

  afterEach((done) => {
    delete process.env.USER_PATH
    fsEx.remove(testFolder, done)
  })

  it('should have default settingsFolder', () => {
    delete process.env.USER_PATH
    assert.ok(new UserSettings().settingsFolder.includes('.sgcloud'))
  })

  it('should accept USER_PATH env as settingsFolder', () => {
    testFolder = path.join('build', '-testFoobar-')
    process.env.USER_PATH = testFolder
    assert.equal(new UserSettings().settingsFolder, testFolder)
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
