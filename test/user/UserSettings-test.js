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

  it('should return session loaded from file', () => {
    const userSettings = new UserSettings()
    const session = {token: 'foo', user: 'bar'}
    fsEx.ensureDirSync(userSettings.settingsFolder)
    fsEx.writeJsonSync(userSettings.sessionFile, {token: 'foo', user: 'bar'})

    assert.equal(session.token, userSettings.getToken())
    assert.equal(session.user, userSettings.getUsername())
  })

  it('should save all settings', () => {
    const token = {foo: 'bar'}
    const user = 'foo@bar.baz'
    const userSettings = new UserSettings()
    userSettings.setToken(token)
    userSettings.setUsername(user)
    userSettings.validate()

    assert.deepEqual(fsEx.readJsonSync(userSettings.sessionFile).token, token)
    assert.deepEqual(fsEx.readJsonSync(userSettings.sessionFile).user, user)
  })
})
