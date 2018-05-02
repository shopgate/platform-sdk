const path = require('path')
const fork = require('child_process').fork
const chokidar = require('chokidar')
const async = require('neo-async')
const errio = require('errio')
const bunyan = require('bunyan')
const osLocale = require('os-locale')

const program = path.resolve(path.join(__dirname, 'runtime.js'))
const LogStream = require('../../../utils/logstream')
const { PIPELINES_FOLDER, EXTENSIONS_FOLDER } = require('../../Constants')

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
   */
  constructor (log, appSettings, dcHttpClient, inspect) {
    this.log = log
    this.openCalls = {}
    this.openTimeouts = {}
    this.calls = 0
    this.childProcess = null
    this.stepTimeout = 8000
    this.appSettings = appSettings
    this.dcHttpClient = dcHttpClient
    this.watcherOptions = {
      ignored: [
        'node_modules/**',
        '**/node_modules/**',
        '**/.*/**',
        `${EXTENSIONS_FOLDER}/**/${PIPELINES_FOLDER}/**`
      ],
      ignoreInitial: true
    }

    const streams = []

    if (process.env.INTEGRATION_TEST === 'true') {
      streams.push({ level: process.env.LOG_LEVEL || 'debug', stream: process.stdout })
    } else {
      streams.push({ stream: new LogStream(osLocale.sync().replace('_', '-')), type: 'raw', level: 'debug' })
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

      this.childProcess = fork(program, { execArgv }, childProcessOptions)
      this.childProcess.on('error', err => this.log.error(err, 'Step Executor Error'))
      this.childProcess.on('exit', (code, signal) => this.onExit(code, signal))
      this.childProcess.on('disconnect', () => this.log.debug('child process IPC disconnected'))
      this.childProcess.on('message', msg => {
        if (msg.ready) {
          this.log.info('Runtime started')
          return resolve()
        }
        this.onMessage(msg)
      })
    })
  }

  startWatcher () {
    return new Promise(resolve => {
      const extensionDirs = path.join(this.appSettings.getApplicationFolder(), EXTENSIONS_FOLDER, '**')
      const extensionSteps = path.join(extensionDirs, 'extension', '*.js')
      const extensionStepsInSubfolders = path.join(extensionDirs, 'extension', '**', '*.js')
      this.watcher = chokidar.watch([extensionSteps, extensionStepsInSubfolders], this.watcherOptions)

      let queued = false
      this.watcher.on('all', () => {
        if (queued) return
        queued = true
        setTimeout(() => {
          this.log.info('Extension file was changed, restarting')
          this.stop()
            .then(() => {
              return this.start()
            })
            .then(() => {
              queued = false
            })
            .catch((err) => {
              queued = false
              return this.log.warn(err, 'Watcher could not restart childProcess')
            })
        }, 500)
      })
      this.watcher.on('ready', () => resolve())
    })
  }

  stopWatcher () {
    return new Promise((resolve, reject) => {
      if (!this.watcher) return resolve()
      this.watcher.removeAllListeners()
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

  onExit (code, signal) {
    const stop = this.childProcess.stop
    this.childProcess = null
    if (code === null) return this.log.info('Runtime stopped')

    this.log.error({ code }, 'Runtime crashed' + (!stop ? ', restarting' : ''))
    if (stop) return
    this.start((err) => {
      if (err) this.log.error(err)
    })
  }

  stop () {
    return new Promise((resolve) => {
      if (!this.childProcess || !this.childProcess.connected) return resolve()

      this.log.debug('Shutting down Step Executor')
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
          this.log.warn(msg, 'Got message from step runtime but no callback there, maybe timeouted or double used')
          break
        }
        clearTimeout(this.openTimeouts[msg.callId])
        delete this.openTimeouts[msg.callId]
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
        this.log.warn(msg, 'Unknown message from step runtime')
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
    if (!this.childProcess || !this.childProcess.connected) return cb(new Error('Process not running, please restart or try again in a few seconds'))
    const callId = this.calls++
    this.openCalls[callId] = cb
    this.openTimeouts[callId] = setTimeout(() => {
      delete this.openCalls[callId]
      delete this.openTimeouts[callId]
      const err = new Error(`Step '${stepMeta.path}' timeout`)
      err.code = 'ETIMEOUT'
      cb(errio.toObject(err))
    }, this.stepTimeout)
    this.latestStepMeta = stepMeta
    this.childProcess.send({ input, stepMeta, callId })
  }
}

module.exports = StepExecutor
