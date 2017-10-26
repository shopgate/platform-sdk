const restify = require('restify')
const morgan = require('morgan')
const ip = require('ip')
const { cyan } = require('chalk')
const setContentTypeHeaders = require('./middlewares/setContentTypeHeaders')
const setCrossOriginHeaders = require('./middlewares/setCrossOriginHeaders')
const logErrors = require('./middlewares/logErrors')
const xhrErrorHandler = require('./middlewares/xhrErrorHandler')

const server = restify.createServer()

server.use(setContentTypeHeaders)
server.use(setCrossOriginHeaders)
server.use(logErrors)
server.use(xhrErrorHandler)

if (!process.env.silent) {
  server.use(morgan('dev'))
}

const PORT = 9666

server.listen(PORT, () => {
  console.log(`Localhost: ${cyan(`http://localhost:${PORT}`)}`)
  console.log(`LAN:       ${cyan(`http://${ip.address()}:${PORT}`)}`)
  console.log(`\nPress ${cyan.bold('CTRL-C')} to stop the server!`)
})
