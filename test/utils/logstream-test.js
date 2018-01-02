const assert = require('assert')
const bunyan = require('bunyan')
const LogStream = require('../../lib/utils/logstream')

let sout = {
  write: null
}

let serr = {
  write: null
}

let logger = null
let locale = 'en-US'

describe('LogStream', () => {
  beforeEach(() => {
    sout.write = null
    serr.write = null

    logger = bunyan.createLogger({
      name: '\u0008',
      streams: [
        {
          level: 'info',
          stream: new LogStream(locale, sout, serr),
          type: 'raw'
        }
      ]
    })
    logger.plain = console.log
  })

  it('should log "this is the string I want to log" as info and an extra', (done) => {
    const msg = 'this is the string I want to log'
    sout.write = (sMsg) => {
      assert.ok(sMsg.indexOf(msg) !== -1)
      done()
    }
    logger.info({extra: 'extra'}, msg)
  })

  it('should log "sth went wrong" as error and an extra', done => {
    const msg = 'sth. went wrong'
    serr.write = (sMsg) => {
      assert.ok(sMsg.indexOf(msg) !== -1)
      assert.ok(sMsg.indexOf('hans') !== -1)
      assert.ok(sMsg.indexOf('extra') !== -1)
      assert.ok(sMsg.indexOf('bar') !== -1)
      done()
    }
    logger.error({extra: {foo: 'bar'}, err: {stack: 'hans'}}, msg)
  })

  it('should log with en-US locale', (done) => {
    const date = new Date(1000 * 60 * 13)
    serr.write = (msg) => {
      assert.ok(msg.indexOf(date.toLocaleString('en-US')) !== -1)
      done()
    }

    logger.error({time: date}, 'sth. went wrong')
  })

  it('should log with de-DE locale', (done) => {
    const date = new Date(1000 * 60 * 13)
    serr.write = (msg) => {
      assert.ok(msg.indexOf(date.toLocaleString('de-DE')) !== -1)
      done()
    }

    locale = 'de-DE'

    logger = bunyan.createLogger({
      name: '\u0008',
      streams: [
        {
          level: 'info',
          stream: new LogStream(locale, sout, serr),
          type: 'raw'
        }
      ]
    })
    logger.plain = console.log

    logger.error({time: date}, 'sth. went wrong')
  })
})
