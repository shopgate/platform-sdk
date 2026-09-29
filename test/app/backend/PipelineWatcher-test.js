const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const { EXTENSIONS_FOLDER, PIPELINES_FOLDER } = require('../../../lib/app/Constants')
const PipelineWatcher = require('../../../lib/app/backend/PipelineWatcher')

// These tests run against real chokidar on purpose: a mocked watcher cannot reproduce the
// behaviour that matters here (empty path lists, folders appearing later, directory events).
const WATCH_TIMEOUT = 15000

describe('PipelineWatcher', function () {
  // real file system events need more headroom than mocha's default timeout
  this.timeout(WATCH_TIMEOUT * 3)

  let appPath
  let pipelineWatcher
  let events

  const start = async () => {
    await pipelineWatcher.start()
    events = []
    pipelineWatcher.on('all', (event, file) => events.push({ event, file }))
    // 'ready' does not guarantee that the underlying watches are armed yet, so a change made in
    // that window can be missed - which only shows up when the machine is busy
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  const waitForEvent = async (predicate) => {
    const deadline = Date.now() + WATCH_TIMEOUT
    while (Date.now() < deadline) {
      if (events.some(predicate)) return true
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    return false
  }

  const extensionPipelines = (extension) =>
    path.join(appPath, EXTENSIONS_FOLDER, extension, PIPELINES_FOLDER)

  beforeEach(async () => {
    appPath = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    process.env.APP_PATH = appPath
    pipelineWatcher = new PipelineWatcher({ getApplicationFolder: () => appPath })
  })

  afterEach(async () => {
    delete process.env.APP_PATH
    await pipelineWatcher.close()
    // let the file system watches settle before the tree is removed underneath them
    await new Promise(resolve => setTimeout(resolve, 100))
    await fsEx.remove(appPath)
  })

  it('should emit changed pipeline', async () => {
    const pipelinePath = path.join(extensionPipelines('testExtension'), 'somePipeline.json')
    await fsEx.ensureDir(extensionPipelines('testExtension'))
    await start()

    await fsEx.writeJson(pipelinePath, { id: 'somePipeline' })

    assert.ok(await waitForEvent(({ file }) => file === pipelinePath), 'no event for the pipeline')
  })

  it('should resolve when no extension has a pipelines folder', async () => {
    await fsEx.ensureDir(path.join(appPath, EXTENSIONS_FOLDER, 'withoutPipelines'))

    // start() would never settle if it waited for a 'ready' that chokidar does not emit
    await start()

    assert.ok(pipelineWatcher.watcher, 'no watcher was created')
  })

  it('should watch an extensions folder that does not exist yet at the start', async () => {
    await fsEx.remove(path.join(appPath, EXTENSIONS_FOLDER))

    await start()

    const pipelinePath = path.join(extensionPipelines('firstExtension'), 'first.json')
    await fsEx.ensureDir(extensionPipelines('firstExtension'))
    await fsEx.writeJson(pipelinePath, { id: 'first' })

    assert.ok(await waitForEvent(({ file }) => file === pipelinePath),
      'nothing was watched after the extensions folder appeared')
  })

  it('should watch a pipelines folder that is created after the start', async () => {
    await start()

    const pipelinePath = path.join(extensionPipelines('lateExtension'), 'late.json')
    await fsEx.ensureDir(extensionPipelines('lateExtension'))
    await fsEx.writeJson(pipelinePath, { id: 'late' })

    assert.ok(await waitForEvent(({ file }) => file === pipelinePath), 'late pipeline was not watched')
  })

  // Asserted on the predicate rather than on emitted events: whether a symlinked folder is kept is
  // a pure decision, while waiting for the corresponding event is inherently timing dependent.
  it('should not filter out a symlinked extension folder', async () => {
    const linkTarget = path.join(appPath, 'externally-developed-extension')
    const link = path.join(appPath, EXTENSIONS_FOLDER, 'linkedExtension')
    await fsEx.ensureDir(path.join(linkTarget, PIPELINES_FOLDER))
    await fsEx.ensureDir(path.join(appPath, EXTENSIONS_FOLDER))
    await fsEx.ensureSymlink(linkTarget, link, 'dir')
    const pipeline = path.join(link, PIPELINES_FOLDER, 'linked.json')
    await fsEx.writeJson(pipeline, { id: 'linked' })

    const { ignored } = pipelineWatcher._getWatcherOptions()
    const linkStats = await fsEx.lstat(link)

    assert.equal(linkStats.isDirectory(), false, 'precondition: a symlink is not reported as a directory')
    assert.equal(ignored(link, linkStats), false, 'the symlinked extension folder was filtered out')
    assert.equal(ignored(path.join(link, PIPELINES_FOLDER), await fsEx.stat(path.join(link, PIPELINES_FOLDER))), false)
    assert.equal(ignored(pipeline, await fsEx.stat(pipeline)), false)
  })

  it('should not emit a file event for a directory inside a pipelines folder', async () => {
    await fsEx.ensureDir(extensionPipelines('testExtension'))
    await start()

    await fsEx.ensureDir(path.join(extensionPipelines('testExtension'), 'subfolder'))
    // give chokidar the same chance it gets in the positive tests
    await new Promise(resolve => setTimeout(resolve, 1500))

    const fileEvents = events.filter(({ event }) => ['add', 'change', 'unlink'].includes(event))
    assert.deepEqual(fileEvents, [], 'a directory was reported as a pipeline file')
  })
})
