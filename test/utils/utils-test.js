const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const proxyquire = require('proxyquire')
const { promisify } = require('util')
const { EXTENSIONS_FOLDER, THEMES_FOLDER } = require('../../lib/app/Constants')

const logger = {
  debug: (message) => {},
  warn: (message) => {},
  info: (message) => {}
}

const utils = proxyquire('../../lib/utils/utils', {
  '../logger': logger
})

describe('utils', async () => {
  describe('resetProject', () => {
    const dirs = []
    const files = []
    let tempDir
    let testProjectDir

    before(async () => {
      tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
      testProjectDir = path.join(tempDir, 'testProject')

      const settingsDir = path.join(testProjectDir, '.sgcloud')
      const ext1Dir = path.join(testProjectDir, 'extensions', 'te1', 'extension')
      const ext2Dir = path.join(testProjectDir, 'extensions', 'te2', 'extension')
      const theme1Dir = path.join(testProjectDir, 'themes', 'tt1', 'config')
      const theme2Dir = path.join(testProjectDir, 'themes', 'tt2', 'config')
      const plDir = path.join(testProjectDir, 'pipelines')
      const tplDir = path.join(testProjectDir, 'trustedPipelines')

      dirs.push(
        settingsDir,
        ext1Dir,
        ext2Dir,
        theme1Dir,
        theme2Dir,
        plDir,
        tplDir
      )

      const appFile = path.join(settingsDir, 'app.json')
      const storageFile = path.join(settingsDir, 'storage.json')
      const extensionsFile = path.join(settingsDir, 'attachedExtensions.json')
      const ext1ConfFile = path.join(ext1Dir, 'config.json')
      const ext2ConfFile = path.join(ext2Dir, 'config.json')
      const theme1AppFile = path.join(theme1Dir, 'app.json')
      const theme2AppFile = path.join(theme2Dir, 'app.json')
      const pl = path.join(plDir, 'pl.json')
      const tpl = path.join(tplDir, 'tpl.json')

      files.push(
        appFile,
        storageFile,
        extensionsFile,
        ext1ConfFile,
        ext2ConfFile,
        theme1AppFile,
        theme2AppFile,
        pl,
        tpl
      )
    })

    after(async () => {
      await fsEx.remove(tempDir)
    })

    beforeEach((done) => {
      process.env.APP_PATH = testProjectDir
      dirs.forEach(dir => fsEx.ensureDirSync(dir))
      files.forEach(file => fsEx.writeJSONSync(file, {}))
      done()
    })

    afterEach((done) => {
      delete process.env.APP_PATH
      fsEx.removeSync(testProjectDir)
      done()
    })

    it('should reset the project', async () => {
      await utils.resetProject()
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          const promises = files.map(file => { return fsEx.pathExists(file) })
          const results = await Promise.all(promises)
          for (let i in results) {
            if (results[i]) return reject(new Error(`${files[i]} still exists`))
          }
          resolve()
        }, 1000)
      })
    })
  })

  describe('generateComponentsJson', () => {
    const attachedExtensions = {
      '@a/b': {
        path: 'b'
      },
      '@a/c': {
        path: 'c'
      }
    }

    const extensionConfigs = {
      '@a/b': {
        components: [{
          id: 'comp1',
          type: 'type1',
          path: 'path1'
        }, {
          id: 'comp2',
          type: 'type2',
          path: 'path2'
        }]
      },
      '@a/c': {
        components: [{
          id: 'comp3',
          type: 'type3',
          path: 'path3'
        }, {
          id: 'comp4',
          type: 'type4',
          path: 'path4'
        }]
      }
    }

    const themes = ['gmd', 'ios']
    const appSettings = {}

    let tempDir
    let projectDir

    before(async () => {
      tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
      projectDir = path.join(tempDir, 'componentsJSON')

      appSettings.loadAttachedExtensions = () => attachedExtensions
      appSettings.getApplicationFolder = () => projectDir
    })

    beforeEach(async () => {
      await fsEx.ensureDir(projectDir)

      // ensure extensions and extension configs
      for (let extensionId in attachedExtensions) {
        const extDir = path.join(projectDir, EXTENSIONS_FOLDER, attachedExtensions[extensionId].path)
        await fsEx.ensureDir(extDir)
        await fsEx.writeJson(path.join(extDir, 'extension-config.json'), extensionConfigs[extensionId])
      }

      // ensure themes and theme config dirs
      for (let i in themes) {
        const themeDir = path.join(projectDir, THEMES_FOLDER, themes[i])
        await fsEx.ensureDir(path.join(themeDir, 'config'))
        await fsEx.writeJson(path.join(themeDir, 'extension-config.json'), {})
      }
    })

    afterEach(async () => fsEx.remove(projectDir))

    after(async () => fsEx.remove(tempDir))

    it('should create components json', async () => {
      await utils.generateComponentsJson(appSettings)
      const t1 = await fsEx.readJson(path.join(projectDir, THEMES_FOLDER, 'gmd', 'config', 'components.json'))
      const t2 = await fsEx.readJson(path.join(projectDir, THEMES_FOLDER, 'ios', 'config', 'components.json'))

      const expectedResult = {
        type1: { '@a/b/comp1': { path: 'b/path1' } },
        type2: { '@a/b/comp2': { path: 'b/path2' } },
        type3: { '@a/c/comp3': { path: 'c/path3' } },
        type4: { '@a/c/comp4': { path: 'c/path4' } }
      }

      assert.deepEqual(t1, expectedResult)
      assert.deepEqual(t2, expectedResult)
    })
  })

  describe('findThemes', () => {
    let tempDir
    let testFolder

    const appSettings = {
      getApplicationFolder: () => testFolder
    }

    const validThemes = ['ios', 'gmd']
    const dirs = validThemes.concat(['.git', '.idea'])

    before(async () => {
      tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
      testFolder = path.join(tempDir, 'findThemesTest')
    })

    beforeEach(async () => {
      for (let i in dirs) {
        await fsEx.ensureDir(path.join(testFolder, THEMES_FOLDER, dirs[i]))
      }

      for (let i in validThemes) {
        await fsEx.writeJSON(path.join(testFolder, THEMES_FOLDER, validThemes[i], 'extension-config.json'), {})
      }
    })

    afterEach(async () => fsEx.remove(testFolder))

    after(async () => fsEx.remove(tempDir))

    it('should find all valid themes', async () => {
      const themes = await utils.findThemes(appSettings)

      for (let i in validThemes) {
        assert.ok(themes.includes(validThemes[i]))
      }
    })
  })

  describe('getBlacklistedExtensions', () => {
    afterEach(() => {
      delete process.env.IGNORE_EXT_CONFIG_FOR
    })

    it('should return the blacklisted extensions', () => {
      const extensions = ['extension1', '@super-coolio2', 'hans.234']

      process.env.IGNORE_EXT_CONFIG_FOR = extensions.join(',')
      const list = utils.getBlacklistedExtensions()
      assert.deepEqual(list, extensions)
    })

    it('should return an empty string if there are no blacklisted extensions', () => {
      const list = utils.getBlacklistedExtensions()
      assert.deepEqual(list, [])
    })
  })
})
