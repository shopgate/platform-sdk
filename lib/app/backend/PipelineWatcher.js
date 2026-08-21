const chokidar = require('chokidar')
const path = require('path')
const fsEx = require('fs-extra')
const async = require('neo-async')
const t = require('../../i18n')(__filename)

const { EXTENSIONS_FOLDER, PIPELINES_FOLDER } = require('../../../lib/app/Constants')

// Matched on the path below the extensions folder, never on the absolute one: that would also
// match segments of the project's own location, e.g. a checkout inside a hidden directory.
const IGNORED_PATH = /(^|[/\\])(node_modules|\.[^/\\])/

class PipelineWatcher {
  /**
   * @param {AppSettings} appSettings
   */
  constructor (appSettings) {
    this.appFolder = appSettings.getApplicationFolder()
    this.watchFolder = path.join(this.appFolder, EXTENSIONS_FOLDER)
    this.chokidar = chokidar
  }

  /**
   * chokidar watches concrete paths, not patterns: a path is either a file or a directory it walks.
   * 'extensions/<ext>/pipelines/*.json' is therefore expressed as the extensions folder plus a
   * predicate. Watching the folder rather than a fixed list of paths also keeps extensions and
   * pipeline folders that are created later covered, while the depth limit and the predicate keep
   * the number of watched paths small.
   * @return {Object}
   */
  _getWatcherOptions () {
    return {
      ignoreInitial: true,
      depth: 2,
      ignored: (filePath, stats) => {
        if (filePath === this.watchFolder) return false
        // decided without stats, so it holds for the calls chokidar makes before it stats a path
        if (IGNORED_PATH.test(path.relative(this.watchFolder, filePath))) return true
        if (!stats) return false
        // a symlinked extension folder is not reported as a directory, so it must not be judged
        // by the rules below - dropping it would silently unwatch locally linked extensions
        if (stats.isSymbolicLink()) return false

        const parts = path.relative(this.watchFolder, filePath).split(path.sep)
        if (stats.isDirectory()) {
          // of an extension only its pipelines folder matters, and nothing below it
          return parts.length > 2 || (parts.length === 2 && parts[1] !== PIPELINES_FOLDER)
        }
        return !(parts.length === 3 && parts[1] === PIPELINES_FOLDER && path.extname(filePath) === '.json')
      }
    }
  }

  async start () {
    // a watcher rooted at a path that does not exist reports only the directories appearing later,
    // never the files inside them - so the folder has to exist before it is watched
    await fsEx.ensureDir(this.watchFolder)

    return new Promise((resolve) => {
      this.watcher = this.chokidar.watch(this.watchFolder, this._getWatcherOptions())
      this.watcher.on('ready', () => resolve())
    })
  }

  on (event, fn) {
    this.watcher.on(event, fn)
  }

  async close () {
    if (!this.watcher) return

    // chokidar sets 'closed' synchronously but tears down asynchronously, so the returned promise
    // has to be awaited - otherwise the watcher still holds handles after close() resolved
    await this.watcher.close()

    return new Promise((resolve, reject) => {
      async.retry({ times: 5, interval: 10 }, (acb) => {
        if (this.watcher.closed) return acb()
        acb(new Error(t('ERROR_NOT_DISCONNECTED')))
      }, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }
}

module.exports = PipelineWatcher
