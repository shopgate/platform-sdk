const assert = require('assert')
const path = require('path')
const fsEx = require('fs-extra')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const PipelineWatcher = require('../lib/PipelineWatcher')

const appPath = path.join('build', 'appsettings')

describe('PipelineWatcher', () => {
  let pipelineWatcher

  beforeEach((done) => {
    process.env.APP_PATH = appPath
    pipelineWatcher = new PipelineWatcher()
    mkdirp.sync(pipelineWatcher.pipelineFolder)
    pipelineWatcher.start(done)
  })

  afterEach((done) => {
    delete process.env.APP_PATH
    pipelineWatcher.close()
    rimraf(appPath, done)
  })

  it('should emit changed pipeline', (done) => {
    const pipelinePath = path.join(pipelineWatcher.pipelineFolder, 'somePipeline.json')

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
