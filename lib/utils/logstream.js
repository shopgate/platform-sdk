const ansistyles = require('ansistyles')
const ansicolor = require('ansicolors')
const util = require('util')

const styles = Object.assign(ansistyles, ansicolor)

const TRACE = 10
const DEBUG = 20
const INFO = 30
const WARN = 40
const ERROR = 50
const FATAL = 60

const levelFromName = {
  'trace': TRACE,
  'debug': DEBUG,
  'info': INFO,
  'warn': WARN,
  'error': ERROR,
  'fatal': FATAL
}

const colorFromLevel = {
  10: 'brightBlack', // TRACE
  20: 'brightBlack', // DEBUG
  30: 'green', // INFO
  40: 'magenta', // WARN
  50: 'red', // ERROR
  60: 'inverse' // FATAL
}

const nameFromLevel = {}
const upperNameFromLevel = {}
const upperPaddedNameFromLevel = {}

Object.keys(levelFromName).forEach((name) => {
  nameFromLevel[levelFromName[name]] = name
  upperNameFromLevel[levelFromName[name]] = name.toUpperCase()
  upperPaddedNameFromLevel[levelFromName[name]] = (name.length === 4 ? ' ' : '') + name.toUpperCase()
})

function isValidRecord (rec) {
  return !(rec.v === null || rec.level === null || rec.name === null || rec.hostname === null || rec.pid === null || rec.time === null || rec.msg === null)
}

function indent (s) {
  return '  ' + s.split(/\r?\n/).join('\n  ')
}

function stylize (s, color) {
  if (!s) return ''
  var fn = styles[color]
  return fn ? fn(s) : s
}

class LogStream {
  constructor (locale, stdout, stderr, additionalInfoOnErrorOrAbove) {
    this.locale = locale || 'en-US'
    this.out = stdout || process.stdout
    this.error = stderr || process.stderr
    this.additionalInfoOnErrorOrAbove = additionalInfoOnErrorOrAbove || false
  }

  write (rec) {
    if (typeof rec !== 'object') return console.error('raw stream got a non-object record: %j', rec)
    if (!isValidRecord(rec)) return console.error('raw stream got a non-valid-object record: %j', rec)

    delete rec.v

    if (rec.level <= 40 || !this.additionalInfoOnErrorOrAbove) {
      // No need if not ERROR or FATAL
      delete rec.hostname
      delete rec.pid
    }

    // Set time
    const time = stylize(rec.time.toLocaleString(this.locale), 'brightBlack')
    delete rec.time

    // Set level
    const logLevel = rec.level
    const level = stylize(upperPaddedNameFromLevel[rec.level] || 'LVL' + rec.level, colorFromLevel[rec.level])
    delete rec.level

    // Set name
    const nameStr = rec.component ? `${rec.name}/${rec.component}` : rec.name
    delete rec.component
    delete rec.name

    const extras = []
    const details = []

    // Set message
    let onelineMsg = ''
    if (rec.msg.indexOf('\n') !== -1) {
      details.push(indent(stylize(rec.msg, 'cyan')))
    } else {
      onelineMsg = ' ' + stylize(rec.msg, 'cyan')
    }
    delete rec.msg

    // Add error stack to details if present
    if (rec.err && rec.err.stack) {
      details.push(indent(rec.err.stack))
      delete rec.err
    }

    // Add all remaining keys in extras
    const leftover = Object.keys(rec)
    for (var i = 0; i < leftover.length; i++) {
      const key = leftover[i]
      let value = rec[key]
      let stringified = false
      if (typeof (value) !== 'string') {
        value = JSON.stringify(value, null, 2)
        stringified = true
      }
      if (value.indexOf('\n') !== -1 || value.length > 50) {
        details.push(indent(key + ': ' + value))
      } else if (!stringified && (value.indexOf(' ') !== -1 ||
        value.length === 0)) {
        extras.push(key + '=' + JSON.stringify(value))
      } else {
        extras.push(key + '=' + value)
      }
    }

    // Create extras and details string
    const extrasStr = stylize((extras.length ? ' (' + extras.join(', ') + ')' : ''), 'brightBlack')
    const detailsStr = stylize((details.length ? details.join('\n  --\n') + '\n' : ''), 'brightBlack')

    const output = util.format('%s %s %s:%s%s\n%s', time, level, nameStr, onelineMsg, extrasStr, detailsStr)

    if (logLevel <= 40) return this.out.write(output)
    return this.error.write(output)
  }
}

module.exports = LogStream
