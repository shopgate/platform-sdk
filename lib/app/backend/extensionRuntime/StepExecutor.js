const path = require('path')
const fork = require('child_process').fork
const chokidar = require('chokidar')
const async = require('neo-async')
const errio = require('errio')
const bunyan = require('bunyan')
const LogStream = require('../../../utils/logstream')
const getLocale = require('../../../utils/locale')
const { EXTENSIONS_FOLDER } = require('../../Constants')
const t = require('../../../i18n')(__filename)

const STEP_FOLDER = 'extension'
const IGNORED_PATH = /(^|[/\\])(node_modules|\.[^/\\])/
// Steps are js, but they also read json next to them, e.g. translations. The generated config.json
// is excluded because the runtime re-reads it on every step call, and dependency manifests because
// installing inside an extension should not restart the runtime.
const STEP_FILE = /\.(js|json)$/
const NOT_A_STEP_FILE = /^(config|package|package-lock)\.json$/

const program = path.resolve(path.join(__dirname, 'runtime.js'))
const childProcessOptions = {
  stdio: [process.stdin, process.stdout, process.stderr, 'ipc'],
  detached: true,
  windowsHide: true
}

class StepExecutor {
  /**
   * @param {Logger} log
   * @param {AppSettings} appSettings
   * @param {DcHttpClient} dcHttpClient
   * @param {boolean} inspect
   * @param {{keys: Array<{alias: string, publicKeyPem: string}>, unavailableReason: string}} [encryptionKeys]
   *   loaded once by the backend start process, see BackendAction#loadEncryptionKeys
   */
  constructor (log, appSettings, dcHttpClient, inspect, encryptionKeys = { keys: [], unavailableReason: '' }) {
    this.log = log
    this.openCalls = {}
    this.openTimeouts = {}
    this.calls = 0
    this.childProcess = null
    this.restartTimer = null
    this.restartQueued = false
    this.stepTimeout = 8000
    this.appSettings = appSettings
    this.dcHttpClient = dcHttpClient
    this.encryptionKeys = encryptionKeys
    this.watchFolder = path.join(appSettings.getApplicationFolder(), EXTENSIONS_FOLDER)
    // chokidar's 'ignored' honours functions and regular expressions, but not glob strings.
    // Matching is done on the path below the extensions folder: an absolute path would also match
    // segments of the project's own location, e.g. a checkout inside a hidden directory.
    this.watcherOptions = {
      ignored: (filePath, stats) => {
        if (IGNORED_PATH.test(path.relative(this.watchFolder, filePath))) return true
        if (!stats || !stats.isFile()) return false
        return !STEP_FILE.test(filePath) || NOT_A_STEP_FILE.test(path.basename(filePath))
      },
      ignoreInitial: true
    }

    const streams = []

    if (process.env.INTEGRATION_TEST === 'true') {
      streams.push({ level: process.env.LOG_LEVEL || 'debug', stream: process.stdout })
    } else {
      streams.push({ stream: new LogStream(getLocale()), type: 'raw', level: 'debug' })
    }

    this.inspect = inspect

    // Init special step logger with its own log level
    this.stepLogger = bunyan.createLogger({
      name: '\u0008',
      streams
    })
    this.stepLogger.plain = console.log
  }

  start () {
    return new Promise((resolve, reject) => {
      if (this.childProcess) return reject(new Error('childProcess already running'))

      const execArgv = []
      if (this.inspect) {
        execArgv.push('--inspect')
      }

      // Both variables are always set so that a stale value can never leak in from the outside.
      // The keys were fetched once at backend start, so a watcher restart costs no round trip.
      const forkOptions = {
        ...childProcessOptions,
        execArgv,
        env: {
          ...process.env,
          ENCRYPTION_PUBLIC_KEYS: JSON.stringify(this.encryptionKeys.keys),
          ENCRYPTION_KEYS_UNAVAILABLE: this.encryptionKeys.unavailableReason
        }
      }

      this.childProcess = fork(program, [], forkOptions)
      this.childProcess.on('error', err => this.log.error(err, 'Step Executor Error'))
      this.childProcess.on('exit', (code, signal) => this.onExit(code, signal))
      this.childProcess.on('disconnect', () => this.log.debug('child process IPC disconnected'))
      this.childProcess.on('message', msg => {
        if (msg.ready) {
          this.log.info(t('RUNTIME_STARTED'))
          return resolve()
        }
        this.onMessage(msg)
      })
    })
  }

  /**
   * Collects the step folders of all attached extensions. The runtime only ever executes steps of
   * attached extensions, and watching those folders directly keeps chokidar from walking the whole
   * extensions folder. Folders that do not exist yet are included: chokidar watches their parent
   * and picks them up once created, so an extension that gains a backend needs no restart.
   * @return {Promise<string[]>}
   */
  async _getStepFolders () {
    const attachedExtensions = await this.appSettings.loadAttachedExtensions()

    return Object.values(attachedExtensions)
      .map(extension => path.join(this.watchFolder, extension.path, STEP_FOLDER))
  }

  async startWatcher () {
    const stepFolders = await this._getStepFolders()

    return new Promise(resolve => {
      this.watcher = chokidar.watch(stepFolders, this.watcherOptions)

      // chokidar never emits 'ready' for an empty path list, which is the normal state while no
      // extension with steps is attached. Waiting for it would block the backend start.
      if (!stepFolders.length) resolve()

      this.watcher.on('all', () => {
        if (this.restartQueued) return
        this.restartQueued = true
        // kept on the instance so that stopWatcher() can cancel it: a timer surviving a watcher
        // restart would run a second stop/start chain against the same child process
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null
          this.log.info(t('EXTENSION_FILE_CHANGED'))
          this.stop()
            .then(() => {
              return this.start()
            })
            .then(() => {
              this.restartQueued = false
            })
            .catch((err) => {
              this.restartQueued = false
              return this.log.warn(err, t('COULD_NOT_RESTART_CHILD_PROCESS'))
            })
        }, 500)
      })
      this.watcher.on('ready', () => resolve())
    })
  }

  async stopWatcher () {
    if (this.restartTimer) clearTimeout(this.restartTimer)
    this.restartTimer = null
    this.restartQueued = false
    if (!this.watcher) return

    this.watcher.removeAllListeners()
    // chokidar sets 'closed' synchronously but tears down asynchronously, so the returned promise
    // has to be awaited - otherwise the watcher still holds handles after stopWatcher() resolved
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

  onExit (code, signal) {
    const stop = this.childProcess.stop
    this.childProcess = null
    if (code === null) return this.log.info(t('RUNTIME_STOPPED'))

    this.log.error({ code }, stop ? t('RUNTIME_CRASHED') : t('RUNTIME_CRASHED_RESTARTING'))
    if (stop) return
    this.start((err) => {
      if (err) this.log.error(err)
    })
  }

  stop () {
    return new Promise((resolve) => {
      if (!this.childProcess || !this.childProcess.connected) return resolve()

      this.log.debug(t('SHUTTING_DOWN_STEP_EXECUTOR'))
      this.childProcess.on('exit', () => resolve())
      this.childProcess.disconnect()
      this.childProcess.kill('SIGINT')
    })
  }

  /**
   * @param {object} msg
   * @param {string} msg.type One of: log, systemLog, output, dcRequest
   * @param {Array} msg.arguments
   * @param {string} [msg.level]
   * @param {number} [msg.callId]
   * @param {object} [msg.output]
   * @param {object} [msg.err]
   * @param {Object} [msg.dcRequest]
   * @param {string} [msg.dcRequest.resourceName]
   * @param {string} [msg.dcRequest.appId]
   * @param {string} [msg.dcRequest.deviceId]
   * @param {string} [msg.dcRequest.requestId]
   */
  async onMessage (msg) {
    switch (msg.type) {
      case 'log':
        const level = msg.level || 'debug'
        msg.arguments.unshift(`[${this.latestStepMeta.path}]:`)
        this.stepLogger[level](...msg.arguments)
        break
      case 'systemLog':
        const systemLogLevel = msg.level || 'debug'
        this.stepLogger[systemLogLevel](...msg.arguments)
        break
      case 'output':
        if (!this.openCalls[msg.callId]) {
          this.log.warn(msg, t('NO_CALLBACK_FOR_MESSAGE'))
          break
        }
        clearTimeout(this.openTimeouts[msg.callId])
        delete this.openTimeouts[msg.callId]
        if (msg.err) this.stepLogger.warn({ error: msg.err.stack || msg.err.message }, t('STEP_RETURNED_ERROR', { stepPath: this.latestStepMeta.path }))
        this.openCalls[msg.callId](msg.err, msg.output)
        delete this.openCalls[msg.callId]
        break
      case 'dcRequest':
        this.childProcess.send({
          type: 'dcResponse',
          requestId: msg.dcRequest.requestId,
          info: await this.dcHttpClient.getInfos(msg.dcRequest.resourceName, msg.dcRequest.appId, msg.dcRequest.deviceId)
        })
        break
      default:
        this.log.warn(msg, t('UNKNOWN_MESSAGE'))
    }
  }

  /**
   * @param {Object} input
   * @param {Object} stepMeta
   * @param {String} stepMeta.id
   * @param {String} stepMeta.path
   * @param {Error|null} stepMeta.catchableError
   * @param {Boolean} stepMeta.isErrorCatching
   * @param {Object} stepMeta.meta
   * @param cb
   */
  execute (input, stepMeta, cb) {
    if (!this.childProcess || !this.childProcess.connected) return cb(new Error(t('ERROR_PROCESS_NOT_RUNNING')))
    const callId = this.calls++
    this.openCalls[callId] = cb
    this.openTimeouts[callId] = setTimeout(() => {
      delete this.openCalls[callId]
      delete this.openTimeouts[callId]
      const err = new Error(t('ERROR_STEP_TIMEOUT', { stepPath: stepMeta.path }))
      err.code = 'ETIMEOUT'
      cb(errio.toObject(err))
    }, this.stepTimeout)
    this.latestStepMeta = stepMeta
    this.childProcess.send({ input, stepMeta, callId })
  }
}

module.exports = StepExecutor
