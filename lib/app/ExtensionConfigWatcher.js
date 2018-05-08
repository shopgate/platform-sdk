const path = require('path')
const chokidar = require('chokidar')
const fsEx = require('fs-extra')
const async = require('neo-async')
const EventEmitter = require('events')
const logger = require('../logger')
const utils = require('../utils/utils')
const { EXTENSIONS_FOLDER } = require('../../lib/app/Constants')

let recheckInterval
class ExtensionConfigWatcher extends EventEmitter {
  /**
   * @param {Internal.AppSettings} appSettings
   */
  constructor (appSettings) {
    super()
    this.appSettings = appSettings
    this.watchFolder = path.join(appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    this.options = {
      ignoreInitial: true,
      ignored: [
        'node_modules/**',
        '**/node_modules/**',
        '.*',
        '*.snap.*',
        '!*.js*',
        '*.log'
      ]
    }
    this.chokidar = chokidar
  }

  start (source = 'backend') {
    return new Promise((resolve) => {
      const check = source === 'backend' ? 'frontend' : 'backend'
      const doStart = () => {
        logger.debug(`Starting config watcher`)
        const configPath = path.join(this.watchFolder, '*', 'extension-config.json')
        this.watcher = this.chokidar.watch(configPath, this.options)
          .on('all', (event, configPath) => {
            fsEx.readJson(configPath, { throws: false }, (err, config) => {
              if (err || !config) return

              const parts = configPath.split(path.sep)
              const extPath = parts.slice(0, parts.length - 1).join(path.sep)

              this.emit('configChange', { file: config, path: extPath })
            })
          })
          .on('ready', () => resolve())

        if (this.options.ignoreInitial) {
          this.watcher.removeAllListeners('ready')
          return resolve()
        }
      }

      const recheck = () => {
        utils.getProcessId(check, this.appSettings.settingsFolder).then(otherPid => {
          if (!otherPid) {
            clearInterval(recheckInterval)
            doStart()
          }
        })
      }

      utils.getProcessId(check, this.appSettings.settingsFolder).then(otherPid => {
        // no watching needed for now
        if (otherPid) {
          logger.debug(`Skipping start of config watcher, ${check} is running`)
          recheckInterval = setInterval(recheck, 2000)
          resolve()
        } else {
          doStart()
        }
      })
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      if (recheckInterval) clearInterval(recheckInterval)
      if (!this.watcher) return resolve()
      this.watcher.close()
      async.retry({ times: 5, interval: 10 }, (acb) => {
        if (this.watcher.closed) return acb()
        acb(new Error('Not disconnected'))
      }, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }
}

module.exports = ExtensionConfigWatcher
