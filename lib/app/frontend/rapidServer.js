const restify = require('restify')
const morgan = require('morgan')
const ip = require('ip')
const { cyan } = require('chalk')
const setContentTypeHeaders = require('./middlewares/setContentTypeHeaders')
const setCrossOriginHeaders = require('./middlewares/setCrossOriginHeaders')
const logErrors = require('./middlewares/logErrors')
const xhrErrorHandler = require('./middlewares/xhrErrorHandler')

module.exports = (appSettings) => {
  const server = restify.createServer()

  server.use(setContentTypeHeaders)
  server.use(setCrossOriginHeaders)
  server.use(logErrors)
  server.use(xhrErrorHandler)
  server.use(morgan('dev'))

  const PORT = 9666

  server.listen(PORT, () => {
    this.log(`Localhost: ${cyan(`http://localhost:${PORT}`)}`)
    this.log(`LAN:       ${cyan(`http://${ip.address()}:${PORT}`)}`)
    this.log(`\nPress ${cyan.bold('CTRL-C')} to stop the server!`)
  })
}
