const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const { EXTENSIONS_FOLDER } = require('../../lib/app/Constants')
const ExtensionConfigWatcher = require('../../lib/app/ExtensionConfigWatcher')

// These tests run against real chokidar on purpose: a mocked watcher cannot reproduce the
// behaviour that matters here (folders appearing later, symlinks, directory events).
const WATCH_TIMEOUT = 15000

describe('ExtensionConfigWatcher', function () {
  // real file system events need more headroom than mocha's default timeout
  this.timeout(WATCH_TIMEOUT * 3)

  let appPath
  let extensionConfigWatcher
  let changes

  const start = async () => {
    await extensionConfigWatcher.start('backend')
    changes = []
    extensionConfigWatcher.on('configChange', (config) => changes.push(config))
    // 'ready' does not guarantee that the underlying watches are armed yet, so a change made in
    // that window can be missed - which only shows up when the machine is busy
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  const waitForChange = async (predicate) => {
    const deadline = Date.now() + WATCH_TIMEOUT
    while (Date.now() < deadline) {
      if (changes.some(predicate)) return true
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    return false
  }

  const configPathOf = (extension) =>
    path.join(appPath, EXTENSIONS_FOLDER, extension, 'extension-config.json')

  beforeEach(async () => {
    appPath = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    process.env.APP_PATH = appPath
    extensionConfigWatcher = new ExtensionConfigWatcher({
      getApplicationFolder: () => appPath,
      settingsFolder: path.join(appPath, 'build', 'appsettings')
    })
    await fsEx.ensureDir(path.join(appPath, EXTENSIONS_FOLDER))
  })

  afterEach(async () => {
    delete process.env.APP_PATH
    await extensionConfigWatcher.stop()
    // let the file system watches settle before the tree is removed underneath them
    await new Promise(resolve => setTimeout(resolve, 100))
    await fsEx.remove(appPath)
  })

  it('should emit changed config', async () => {
    await fsEx.ensureDir(path.dirname(configPathOf('testExt')))
    await start()

    await fsEx.writeJson(configPathOf('testExt'), { someAttribtue: '2' })

    assert.ok(await waitForChange(({ file }) => file.someAttribtue === '2'), 'no configChange emitted')
  })

  it('should watch an extension folder that is created after the start', async () => {
    await start()

    await fsEx.ensureDir(path.dirname(configPathOf('lateExt')))
    await fsEx.writeJson(configPathOf('lateExt'), { id: 'lateExt' })

    assert.ok(await waitForChange(({ file }) => file.id === 'lateExt'), 'late extension was not watched')
  })

  // Asserted on the predicate rather than on emitted events: whether a symlinked folder is kept is
  // a pure decision, while waiting for the corresponding event is inherently timing dependent.
  it('should not filter out a symlinked extension folder', async () => {
    const linkTarget = path.join(appPath, 'externally-developed-extension')
    const link = path.join(appPath, EXTENSIONS_FOLDER, 'linkedExt')
    await fsEx.ensureDir(linkTarget)
    await fsEx.ensureSymlink(linkTarget, link, 'dir')
    const config = path.join(link, 'extension-config.json')
    await fsEx.writeJson(config, { id: 'linkedExt' })

    const { ignored } = extensionConfigWatcher._getWatcherOptions()
    const linkStats = await fsEx.lstat(link)

    assert.equal(linkStats.isDirectory(), false, 'precondition: a symlink is not reported as a directory')
    assert.equal(ignored(link, linkStats), false, 'the symlinked extension folder was filtered out')
    assert.equal(ignored(config, await fsEx.stat(config)), false)
  })

  it('should watch an extensions folder that does not exist yet at the start', async () => {
    await fsEx.remove(path.join(appPath, EXTENSIONS_FOLDER))

    await start()

    await fsEx.ensureDir(path.dirname(configPathOf('firstExt')))
    await fsEx.writeJson(configPathOf('firstExt'), { id: 'firstExt' })

    assert.ok(await waitForChange(({ file }) => file.id === 'firstExt'),
      'nothing was watched after the extensions folder appeared')
  })

  it('should ignore files below an extension folder', async () => {
    const frontend = path.join(appPath, EXTENSIONS_FOLDER, 'testExt', 'frontend', 'deep')
    await fsEx.ensureDir(frontend)
    await fsEx.ensureDir(path.join(appPath, EXTENSIONS_FOLDER, 'testExt', 'node_modules', 'pkg'))
    await start()

    await fsEx.writeFile(path.join(frontend, 'component.js'), '// changed')
    await fsEx.writeJson(path.join(appPath, EXTENSIONS_FOLDER, 'testExt', 'node_modules', 'pkg', 'package.json'), {})
    await new Promise(resolve => setTimeout(resolve, 1500))

    assert.deepEqual(changes, [], 'a file below an extension folder triggered a config change')
  })
})
