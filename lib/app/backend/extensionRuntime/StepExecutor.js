const path = require('path')
const fork = require('child_process').fork
const program = path.resolve(path.join(__dirname, 'runtime.js'))
const options = {stdio: [process.stdin, process.stdout, process.stderr, 'ipc'], detached: true, windowsHide: true}
const chokidar = require('chokidar')
const async = require('neo-async')

class StepExecutor {
  constructor (log, opts) {
    this.log = log
    this.openCalls = {}
    this.openTimeouts = {}
    this.calls = 0
    this.childProcess = null
    this.stepTimeout = 8000
    this.options = opts || {}
  }

  start (cb) {
    if (this.childProcess) return cb(new Error('childProcess already running'))

    this.log.debug('Step Executor started')
    this.childProcess = fork(program, [], options)
    this.childProcess.on('error', err => this.log.error(err, 'Step Executor Error'))
    this.childProcess.on('exit', (code, signal) => this.onExit(code, signal))
    this.childProcess.on('message', msg => {
      if (msg.ready) return cb()
      this.onMessage(msg)
    })
    this.childProcess.send({ready: true})
  }

  watch () {
    this.watcher = chokidar.watch('extensions', this.options)

    this.watcher.on('ready', () => {
      this.watcher.on('all', () => {
        this.log.info('extensions were changed, restarting')
        this.stop((err) => {
          if (err) return this.log.warn(err, 'watcher could not restart childProcess')
          this.start((err) => {
            if (err) this.log.warn(err, 'watcher could not restart childProcess')
          })
        })
      })
    })
  }

  onExit (code, signal) {
    const stop = this.childProcess.stop
    this.childProcess = null
    if (code === null) return this.log.info({signal}, 'runtime stopped')

    this.log.error({code}, 'runtime crashed' + (!stop ? ', restarting' : ''))
    if (stop) return
    this.start((err) => {
      if (err) this.log.error(err)
    })
  }

  stop (cb) {
    async.series([
      (sCb) => {
        if (!this.watcher) return sCb()
        this.watcher.close()
        async.retry({times: 5, interval: 10}, (acb) => {
          if (this.watcher.closed) return acb()
          acb(new Error('Not disconnected'))
        }, sCb)
      },
      (sCb) => {
        if (!this.childProcess) return sCb()

        this.log.debug('Shutting down Step Executor')
        this.childProcess.stop = true
        this.childProcess.on('exit', () => sCb())
        this.childProcess.disconnect()
        this.childProcess.kill('SIGINT')
      }
    ], cb)
  }

  /**
   * @param {object} msg
   * @param {string} msg.type
   * @param {string} [msg.level]
   * @param {number} [msg.callId]
   * @param {object} [msg.output]
   * @param {object} [msg.err]
   */
  onMessage (msg) {
    switch (msg.type) {
      case 'log':
        const level = msg.level || 'debug'
        this.log[level](...msg.arguments)
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
      cb(new Error('Step timeout'))
    }, this.stepTimeout)
    this.childProcess.send({input, stepMeta, callId})
  }
}

module.exports = StepExecutor
