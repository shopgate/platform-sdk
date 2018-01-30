const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const sinon = require('sinon')
const async = require('neo-async')
const nock = require('nock')

const UserSettings = require('../../lib/user/UserSettings')
const AppSettings = require('../../lib/app/AppSettings')
const ExtensionAction = require('../../lib/actions/ExtensionAction')
const logger = require('../../lib/logger')

const userSettingsFolder = path.join('build', 'usersettings')
const appPath = path.join('build', 'appsettings')

describe('ExtensionAction', () => {
  const action = new ExtensionAction()
  let userSettings
  let appSettings

  beforeEach(() => {
    process.env.USER_PATH = userSettingsFolder
    process.env.APP_PATH = appPath
    const appId = 'foobarTest'

    appSettings = new AppSettings()
    fsEx.emptyDirSync(path.join(appPath, AppSettings.SETTINGS_FOLDER))
    appSettings.setId(appId)

    fsEx.emptyDirSync(userSettingsFolder)
    userSettings = new UserSettings().setToken({})
  })

  afterEach((done) => {
    delete process.env.USER_PATH
    delete process.env.APP_PATH
    async.parallel([
      (cb) => fsEx.remove(userSettingsFolder, cb),
      (cb) => fsEx.remove(appPath, cb)
    ], done)
  })

  describe('attaching and detaching', () => {
    describe('general', () => {
      it('should register', () => {
        const caporal = {}
        caporal.command = sinon.stub().returns(caporal)
        caporal.description = sinon.stub().returns(caporal)
        caporal.action = sinon.stub().returns(caporal)
        caporal.option = sinon.stub().returns(caporal)
        caporal.argument = sinon.stub().returns(caporal)

        ExtensionAction.register(caporal)

        assert(caporal.command.calledWith('extension create'))
        assert(caporal.description.calledWith('Creates a new extension'))
        assert(caporal.argument.calledWith('[types...]', 'Types of the extension. Possible types are: frontend, backend'))
        assert(caporal.option.calledWith('--extension [extensionName]', 'Name of the new extension (e.g: @myAwesomeOrg/awesomeExtension)'))
        assert(caporal.option.calledWith('--trusted [type]', 'only valid if you\'re about to create a backend extension'))

        assert(caporal.command.calledWith('extension attach'))
        assert(caporal.argument.calledWith('[extensions...]', 'Folder name of the extensions to attach'))
        assert(caporal.description.calledWith('Attaches one or more extensions'))
        assert(caporal.command.calledWith('extension detach'))
        assert(caporal.argument.calledWith('[extensions...]', 'Folder name of the extensions to detach'))
        assert(caporal.description.calledWith('Detaches one or more extensions'))

        assert(caporal.action.callCount === 3)
      })

      it('should throw if user not logged in', () => {
        userSettings.setToken(null)
        try {
          action.attachExtensions({extensions: []})
        } catch (err) {
          assert.equal(err.message, 'You\'re not logged in! Please run `sgcloud login` again.')
        }
      })
    })

    describe('attaching', () => {
      it('should attach if extension exists locally', () => {
        const name = 'existentExtension'
        const id = 'extId'

        const extPath = path.join(appPath, 'extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {id, trusted: false})

        action.attachExtensions({extensions: [name]})

        const config = fsEx.readJsonSync(appSettings.attachedExtensionsFile)
        assert.deepEqual(config.attachedExtensions[id], {path: name, trusted: false})
      })

      it('should attach all local extensions if no one is given', () => {
        const name1 = 'existentExtension1'
        const name2 = 'existentExtension2'

        const extPath1 = path.join(appPath, 'extensions', name1)
        const extPath2 = path.join(appPath, 'extensions', name2)
        fsEx.ensureDirSync(extPath1)
        fsEx.ensureDirSync(extPath2)
        fsEx.writeJSONSync(path.join(extPath1, 'extension-config.json'), {id: 'existentExtension1', trusted: false})
        fsEx.writeJSONSync(path.join(extPath2, 'extension-config.json'), {id: 'existentExtension2', trusted: false})

        action.attachExtensions({extensions: [name1]})
        action.attachExtensions({})
        const config = fsEx.readJsonSync(appSettings.attachedExtensionsFile)
        assert.deepEqual(config.attachedExtensions, {
          existentExtension1: { path: 'existentExtension1', trusted: false },
          existentExtension2: { path: 'existentExtension2', trusted: false }
        })
      })

      it('should throw an error if extension does not exist locally', () => {
        const name = 'notExitstentExtension'

        try {
          action.attachExtensions({extensions: [name]})
        } catch (e) {
          assert.equal(e.message, `Config file of 'notExitstentExtension' is invalid or not existent`)
        }
      })

      it('should throw an error if extension-config is invalid', () => {
        const name = 'existentExtension'

        const extPath = path.join(appPath, 'extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {})

        try {
          action.attachExtensions({extensions: [name]})
        } catch (e) {
          assert.equal(e.message, `Config file of '${name}' is invalid or not existent`)
        }
      })

      it('should throw an error if extension is already attached', () => {
        const name = 'existentExtension'

        const extPath = path.join(appPath, 'extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {id: name})

        action.attachExtensions({extensions: [name]})
        try {
          action.attachExtensions({extensions: [name]})
        } catch (e) {
          assert.equal(e.message, `Extension 'existentExtension (existentExtension) is already attached`)
        }
      })

      it('should throw if user not logged in', () => {
        userSettings.setToken(null)
        try {
          action.attachExtensions({})
        } catch (err) {
          assert.equal(err.message, 'You\'re not logged in! Please run `sgcloud login` again.')
        }
      })
    })

    describe('detaching', () => {
      it('should detach a extension', () => {
        const name = 'existentExtension'

        const extPath = path.join(appPath, 'extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {id: name})

        appSettings.attachExtension(name, {id: name, trusted: false})
        action.detachExtensions({extensions: [name]})

        const config = fsEx.readJsonSync(appSettings.attachedExtensionsFile)
        assert.deepEqual(config.attachedExtensions, {})
      })

      it('should skip if extension was not attached', (done) => {
        const name = 'notExitstentExtension'

        const extPath = path.join(appPath, 'extensions', name)
        fsEx.ensureDirSync(extPath)
        fsEx.writeJSONSync(path.join(extPath, 'extension-config.json'), {id: name})

        logger.warn = (text) => {
          assert.equal(text, `The extension '${name}' is not attached`)
          done()
        }

        action.detachExtensions({extensions: [name]})
      })

      it('should detach all extensions if none was specified', () => {
        appSettings.attachExtension('ext2', {id: 'ext2'})
        appSettings.attachExtension('ext1', {id: 'ext1'})

        action.detachExtensions({})
        const config = fsEx.readJsonSync(appSettings.attachedExtensionsFile)
        assert.deepEqual(config.attachedExtensions, {})
      })
    })
  })

  describe('extension create', () => {
    const extensionFolder = path.join('build', 'extensions')

    beforeEach((done) => {
      nock.disableNetConnect()
      fsEx.ensureDirSync(extensionFolder)
      done()
    })

    afterEach((done) => {
      nock.enableNetConnect()
      /* fsEx.removeSync(extensionFolder) */
      done()
    })

    describe('general', () => {
      it('should create an extension', (done) => {
        const action = new ExtensionAction()

        action._getUserInput = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action._checkIfExtensionExists = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action._downloadBoilerplate = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action._renameBoilerplate = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action._removeUnusedDirs = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action._removePlaceholders = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action._updateBackendFiles = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action._installFrontendDependencies = () => { return new Promise((resolve, reject) => { resolve({}) }) }

        action.createExtension({}, null).then(() => {
          done()
        })
      })

      it('should catch an error because of sth.', () => {
        const action = new ExtensionAction()

        action._getUserInput = () => { return new Promise((resolve, reject) => { resolve() }) }
        action._checkIfExtensionExists = () => { return new Promise((resolve, reject) => { resolve({}) }) }
        action._downloadBoilerplate = (extensionsFolder, state) => {
          state.cloned = true
          return new Promise((resolve, reject) => {
            reject(new Error('error'))
          })
        }
        action._cleanUp = (state) => assert.ok(state.cloned)

        return action.createExtension({}, null)
      })

      it('should throw error "not logged in"', (done) => {
        userSettings.setToken(null)

        try {
          new ExtensionAction().createExtension({}, null)
        } catch (err) {
          assert.equal(err.message, 'You\'re not logged in! Please run `sgcloud login` again.')
          done()
        }
      })
    })

    describe('_getUserInput', () => {
      it('should get the user input by command', () => {
        const options = {
          extension: '@o1/e1',
          trusted: 'trusted'
        }
        const types = ['backend', 'frontend']

        const externalUserInput = {}
        const expected = {
          extensionName: '@o1/e1',
          organizationName: 'o1',
          trusted: false,
          toBeCreated: { frontend: true, backend: true }
        }

        return new ExtensionAction()
          ._getUserInput(options, types, externalUserInput)
          .then(() => {
            assert.deepEqual(externalUserInput, expected)
          })
      })
    })

    describe('_checkIfExtensionExists', () => {
      let tempFolder
      let folderPath
      beforeEach(() => {
        tempFolder = fsEx.mkdtempSync('checkIfExtensionExists')
        folderPath = path.join(tempFolder, AppSettings.EXTENSIONS_FOLDER, 'testExtension')
        fsEx.ensureDirSync(folderPath)
      })

      afterEach(() => {
        fsEx.removeSync(tempFolder)
      })

      it('should get the user input by command', () => {
        const extensionAction = new ExtensionAction()
        extensionAction.appSettings = {getApplicationFolder: () => tempFolder}

        return extensionAction._checkIfExtensionExists('testExtension')
          .then(() => {
            assert.fail('Should not be called')
          })
          .catch((err) => {
            assert.equal(err.message, 'The extension \'testExtension\' already exists')
          })
      })
    })

    describe('_downloadBoilerplate', () => {
      it('should download and unzip the boilerplate', () => {
        const state = {}

        const n = nock('https://github.com')
          .get('/shopgate/cloud-sdk-boilerplate-extension/archive/master.zip')
          .replyWithFile(200, path.join('test', 'testfiles', 'cloud-sdk-boilerplate-extension.zip'), {'Content-Type': 'application/zip'})

        return new ExtensionAction()
          ._downloadBoilerplate(extensionFolder, state)
          .then(() => {
            assert.ok(fsEx.existsSync(path.join(extensionFolder, 'cloud-sdk-boilerplate-extension-master')))
            assert.ok(state.cloned)
            n.done()
          })
      })

      it('should fail because of error while loading or unzipping', () => {
        const state = {}

        const n = nock('https://github.com')
        .get('/shopgate/cloud-sdk-boilerplate-extension/archive/master.zip')
        .reply(404, {error: 'error'})

        return new ExtensionAction()
          ._downloadBoilerplate(extensionFolder, state)
          .catch((err) => {
            assert.ok(err.message.startsWith('Error while downloading boilerplate'))
            n.done()
          })
      })
    })

    describe('_renameBoilerplate', () => {
      const oldName = 'foo'
      const newName = 'bar'

      const userInput = { extensionName: newName }
      const defaultPath = path.join(extensionFolder, oldName)
      const state = {}

      it('should rename the boilerplate dir', () => {
        fsEx.ensureDirSync(path.join(extensionFolder, oldName))

        return new ExtensionAction()
          ._renameBoilerplate(userInput, defaultPath, extensionFolder, state)
          .then(() => {
            const newPath = path.join(extensionFolder, 'bar')
            assert.equal(state.extensionPath, newPath)
            assert.ok(state.moved)
            assert.ok(fsEx.existsSync(newPath))
          })
      })

      it('should fail because moving failed', () => {
        fsEx.ensureDirSync(path.join(extensionFolder, oldName))
        fsEx.ensureDirSync(path.join(extensionFolder, newName, 'test'))

        return new ExtensionAction()
          ._renameBoilerplate(userInput, defaultPath, extensionFolder, state)
          .then(() => {
            if (/^win/.test(process.platform)) return
            assert.fail('It should fail')
          }).catch((err) => {
            if (/^win/.test(process.platform)) return assert.ok(err.message.indexOf('EPERM') !== -1)
            if (/^darwin/.test(process.platform)) return assert.ok(err.message.indexOf('ENOTEMPTY') !== -1)
            assert.ok(
              (err.message.indexOf('EEXIST') !== -1) ||
              (err.message.indexOf('ENOTEMPTY') !== -1)
            )
          })
      })
    })

    describe('_removeUnusedDirs', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      it('should remove the unused dirs', () => {
        const userInput = {
          toBeCreated: {
            backend: false,
            frontend: false
          }
        }

        const state = { extensionPath }

        const dirs = [
          path.join(extensionPath, 'frontend'),
          path.join(extensionPath, 'extension'),
          path.join(extensionPath, 'pipelines')
        ]

        dirs.forEach((dir) => fsEx.ensureDirSync(dir))

        return new ExtensionAction()
          ._removeUnusedDirs(userInput, state)
          .then(() => {
            dirs.forEach((dir) => assert.ok(!fsEx.existsSync(dir)))
          })
      })
    })

    describe('removePlaceHolders', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      beforeEach((done) => {
        fsEx.ensureDirSync(extensionPath)
        done()
      })

      afterEach((done) => {
        fsEx.removeSync(extensionFolder)
        done()
      })

      it('should remove all occurences of /@awesomeOrganization/awesomeExtension and /awesomeOrganization/', () => {
        const userInput = {
          extensionName: '@o1/e1',
          organizationName: 'o1'
        }

        const state = { extensionPath }

        const files = [
          path.join(extensionPath, 'sth.json')
        ]

        const currentFileContent = {extensionId: '@awesomeOrganization/awesomeExtension', pipelineId: 'awesomeOrganization.somePipeline'}
        files.forEach((file) => fsEx.writeJsonSync(file, currentFileContent))

        return new ExtensionAction()
          ._removePlaceholders(userInput, state)
          .then(() => {
            const expectedFileContent = {extensionId: '@o1/e1', pipelineId: 'o1.somePipeline'}
            files.forEach((file) => assert.deepEqual(fsEx.readJsonSync(file), expectedFileContent))
          })
      })

      it('should catch the "No files match the pattern" error', () => {
        const userInput = {
          extensionName: '@o1/e1'
        }

        const state = { extensionPath }

        const file = path.join(extensionPath, 'sth.jsx')
        fsEx.writeJsonSync(file, {awesomeExtension: 'awesomeOrganization'})

        return new ExtensionAction()
          ._removePlaceholders(userInput, state)
          .then(() => {
            assert.deepEqual(fsEx.readJsonSync(file), {awesomeExtension: 'awesomeOrganization'})
          })
      })
    })

    describe('updateBackendFiles', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      beforeEach((done) => {
        fsEx.ensureDirSync(extensionPath)
        done()
      })

      afterEach((done) => {
        fsEx.removeSync(extensionFolder)
        done()
      })

      it('should update/rename backend files', () => {
        const userInput = {
          trusted: true,
          organizationName: 'o1',
          toBeCreated: {
            backend: true
          }
        }
        const state = { extensionPath }

        const pipelineDir = path.join(extensionPath, 'pipelines')
        fsEx.ensureDirSync(pipelineDir)
        fsEx.writeJSON(path.join(pipelineDir, 'awesomeOrganization.awesomePipeline.json'), {})

        const exConfFile = path.join(extensionPath, 'extension-config.json')
        fsEx.writeJSON(exConfFile, {})

        return new ExtensionAction()
          ._updateBackendFiles(userInput, state)
          .then(() => {
            assert.ok(fsEx.exists(path.join(extensionPath, 'pipelines', 'o1.awesomePipeline.json')))
            assert.deepEqual(fsEx.readJsonSync(exConfFile), {trusted: true})
          })
      })

      it('should return early because the function has nothing to do', () => {
        assert.doesNotThrow(() => new ExtensionAction()._updateBackendFiles({toBeCreated: {}}, {}))
      })
    })

    describe('installFrontendDependencies', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')
      const frontendPath = path.join(extensionPath, 'frontend')

      beforeEach((done) => {
        fsEx.ensureDirSync(frontendPath)
        done()
      })

      afterEach((done) => {
        fsEx.removeSync(frontendPath)
        done()
      })

      it('should install the frontend dependencies', () => {
        const state = { extensionPath }
        const userInput = {
          toBeCreated: {
            frontend: true
          }
        }

        fsEx.writeJsonSync(path.join(frontendPath, 'package.json'), {})

        // just do sth.
        const c = {
          command: /^win/.test(process.platform) ? 'npm.cmd' : 'npm',
          params: ['-v']
        }

        return new ExtensionAction()
          ._installFrontendDependencies(userInput, state, c)
      })

      it('should return early because the function has nothing to do', () => {
        assert.doesNotThrow(() => new ExtensionAction()._installFrontendDependencies({toBeCreated: {}}, {}, {}))
      })

      it('should fail because the command failed', () => {
        const state = { extensionPath }
        const userInput = {
          toBeCreated: {
            frontend: true
          }
        }

        fsEx.writeJsonSync(path.join(frontendPath, 'package.json'), {})

        const c = {
          command: /^win/.test(process.platform) ? 'npm.cmd' : 'npm',
          params: ['i', 'nonExistentPackage']
        }

        return new ExtensionAction()
          ._installFrontendDependencies(userInput, state, c)
          .catch((err) => {
            assert.ok(err.message.startsWith('Install process exited with code'))
          })
      }).timeout(10000)
    })

    describe('cleanUp', () => {
      const extensionPath = path.join(extensionFolder, 'ex1')

      beforeEach((done) => {
        fsEx.ensureDirSync(extensionPath)
        done()
      })

      afterEach((done) => {
        fsEx.removeSync(extensionFolder)
        done()
      })

      it('should delete the extension directory', () => {
        const state = {
          cloned: true,
          moved: true,
          extensionPath
        }

        assert.ok(fsEx.existsSync(extensionPath))

        new ExtensionAction()._cleanUp(state, 'doesNotExist')

        assert.ok(!fsEx.existsSync(extensionPath))
      })
    })
  })
})
