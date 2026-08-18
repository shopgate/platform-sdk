const path = require('path')
const chokidar = require('chokidar')
const fsEx = require('fs-extra')
const async = require('neo-async')
const EventEmitter = require('events')
const logger = require('../logger')
const utils = require('../utils/utils')
const { EXTENSIONS_FOLDER } = require('../../lib/app/Constants')
const t = require('../i18n')(__filename)

const EXTENSION_CONFIG_FILE = 'extension-config.json'
// Directory events also reach the handler, e.g. when a whole extension folder is added. Reading
// those as json would throw EISDIR, so only events of an existing file are of interest.
const FILE_EVENTS = ['add', 'change']

let recheckInterval
class ExtensionConfigWatcher extends EventEmitter {
  /**
   * @param {Internal.AppSettings} appSettings
   */
  constructor (appSettings) {
    super()
    this.appSettings = appSettings
    this.watchFolder = path.join(appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    this.chokidar = chokidar
  }

  /**
   * chokidar watches concrete paths, not patterns: a path is either a file or a directory it walks.
   * 'extensions/<ext>/extension-config.json' is therefore expressed as the extensions folder plus a
   * predicate. Watching the folder rather than a fixed list of paths also keeps extensions that are
   * created later covered, while the depth limit and the predicate keep the number of watched paths
   * small - walking the whole tree would mean thousands of them.
   * @return {Object}
   */
  _getWatcherOptions () {
    return {
      ignoreInitial: true,
      depth: 1,
      ignored: (filePath, stats) => {
        if (filePath === this.watchFolder || !stats) return false
        // a symlinked extension folder is not reported as a directory, so it must not be judged
        // by the rules below - dropping it would silently unwatch locally linked extensions
        if (stats.isSymbolicLink()) return false
        // nothing below an extension folder can be an extension config
        if (stats.isDirectory()) return path.relative(this.watchFolder, filePath).split(path.sep).length > 1
        return path.basename(filePath) !== EXTENSION_CONFIG_FILE
      }
    }
  }

  start (source = 'backend') {
    return new Promise((resolve, reject) => {
      const check = source === 'backend' ? 'frontend' : 'backend'
      const doStart = async () => {
        logger.debug(t('STARTING_CONFIG_WATCHER'))

        // a watcher rooted at a path that does not exist reports only the directories appearing
        // later, never the files inside them - so the folder has to exist before it is watched
        await fsEx.ensureDir(this.watchFolder)

        this.watcher = this.chokidar.watch(this.watchFolder, this._getWatcherOptions())
        this.watcher.on('all', async (event, configPath) => {
          if (!FILE_EVENTS.includes(event)) return

          const config = await fsEx.readJson(configPath, { throws: false }).catch(() => null)
          if (config) {
            this.emit('configChange', { file: config, path: path.dirname(configPath) })
          }
        })

        return resolve()
      }

      const recheck = () => {
        utils.getProcessId(check, this.appSettings.settingsFolder).then(otherPid => {
          if (!otherPid) {
            clearInterval(recheckInterval)
            // the outer promise is already resolved at this point, so a rejection would be lost
            doStart().catch(err => logger.error(t('ERROR_STARTING_CONFIG_WATCHER', { message: err.message })))
          }
        })
      }

      utils.getProcessId(check, this.appSettings.settingsFolder).then(otherPid => {
        // no watching needed for now
        if (otherPid) {
          logger.debug(t('ANOTHER_PROCESS_RUNNING'))
          recheckInterval = setInterval(recheck, 2000)
          resolve()
        } else {
          doStart().catch(reject)
        }
      })
    })
  }

  async stop () {
    if (recheckInterval) clearInterval(recheckInterval)
    if (!this.watcher) return

    // chokidar sets 'closed' synchronously but tears down asynchronously, so the returned promise
    // has to be awaited - otherwise the watcher still holds handles after stop() resolved
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

module.exports = ExtensionConfigWatcher
