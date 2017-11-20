const path = require('path')
const fork = require('child_process').fork
const async = require('neo-async')
const program = path.resolve(path.join(__dirname, 'runtime.js'))
const options = {stdio: [process.stdin, process.stdout, process.stderr, 'ipc']}

class StepExecutor {
  constructor (log) {
    this.log = log
    this.openCalls = {}
    this.openTimeouts = {}
    this.calls = 0
    this.childProcess = null
    this.stepTimeout = 8000
  }

  start () {
    this.log.info('Step Executor started')
    this.childProcess = fork(program, [], options)
    this.childProcess.on('message', msg => this.onMessage(msg))
    this.childProcess.on('error', err => this.log.error(err, 'Step Executor Error'))
    this.childProcess.on('exit', code => this.onExit(code))
  }

  onExit (code) {
    if (code !== 0) {
      // call open callbacks
      this.childProcess = null
      async.each(this.openCalls, (callback, callId, cb) => {
        clearTimeout(this.openTimeouts[callId])
        delete this.openCalls[callId]
        delete this.openTimeouts[callId]
        callback(new Error('runtime crashed'))
        cb()
      }, () => {
        this.log.warn('runtime crashed, restarting')
        this.start()
      })
    }
  }

  stop () {
    this.log.info('Shutting down Step Executor')
    this.childProcess.kill('SIGINT')
    this.childProcess = null
  }

  onMessage (msg) {
    if (msg.type === 'log') {
      const level = msg.level || 'debug'
      return this.log[level](...msg.arguments)
    } else if (msg.type === 'output') {
      if (this.openCalls[msg.callId]) {
        clearTimeout(this.openTimeouts[msg.callId])
        delete this.openTimeouts[msg.callId]
        this.openCalls[msg.callId](msg.err, msg.output)
        delete this.openCalls[msg.callId]
      } else {
        this.log.error(msg, 'Got message from step runtime but no callback there, maybe timeouted or double used')
      }
    } else {
      this.log.debug(msg, 'Unknown message from step runtime')
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
