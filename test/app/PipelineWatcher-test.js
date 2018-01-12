const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const PipelineWatcher = require('../../lib/app/backend/PipelineWatcher')
const utils = require('../../lib/utils/utils')

const appPath = path.join('build', 'appsettings')

describe('PipelineWatcher', () => {
  let pipelineWatcher

  beforeEach((done) => {
    process.env.APP_PATH = appPath
    pipelineWatcher = new PipelineWatcher({getApplicationFolder: utils.getApplicationFolder})
    fsEx.emptyDirSync(path.join(pipelineWatcher.appFolder, 'pipelines'))
    pipelineWatcher.start(done)
  })

  afterEach((done) => {
    delete process.env.APP_PATH
    pipelineWatcher.close()
    fsEx.remove(appPath, done)
  })

  it('should emit changed pipeline', (done) => {
    const pipelinePath = path.join(pipelineWatcher.appFolder, 'pipelines', 'somePipeline.json')

    pipelineWatcher.on('all', (event, file) => {
      assert.equal(event, 'add')
      assert.equal(file, pipelinePath)
      done()
    })

    fsEx.writeJson(pipelinePath, {someAttribtue: '2'}, () => {})
  })

  it('should stop watching', () => {
    pipelineWatcher.close()
    assert.ok(pipelineWatcher.watcher.closed)
  })
})
