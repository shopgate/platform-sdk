const path = require('path')
const fork = require('child_process').fork
const program = path.resolve(path.join(__dirname, 'runtime.js'))
const options = {stdio: [process.stdin, process.stdout, process.stderr, 'ipc']}

class StepExecutor {
  constructor (log) {
    this.log = log
    this.openCalls = {}
    this.calls = 0
  }

  start () {
    this.log.info('Step Executor started')
    this.child = fork(program, [], options)
    this.child.on('message', msg => this.onMessage(msg))
    this.child.on('error', err => this.log.error(err, 'Step Executor Error'))
  }

  stop () {
    this.log.info('Shutting down Step Executor')
    this.child.kill('SIGINT')
    this.child = null
  }

  onMessage (msg) {
    if (msg.type === 'log') {
      const level = msg.level || 'debug'
      return this.log[level](...msg.arguments)
    } else if (msg.type === 'output') {
      if (this.openCalls[msg.callId]) {
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
    if (!this.child) return cb(new Error('Process not running, please restart or try again in a few seconds'))
    const callId = this.calls++
    this.openCalls[callId] = cb
    this.child.send({input, stepMeta, callId})
    // TODO: timeout for that callId or something
  }
}

module.exports = StepExecutor
