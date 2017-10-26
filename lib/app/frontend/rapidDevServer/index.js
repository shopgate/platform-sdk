const restify = require('restify')
const morgan = require('morgan')
const setContentTypeHeaders = require('./middlewares/setContentTypeHeaders')
const setCrossOriginHeaders = require('./middlewares/setCrossOriginHeaders')
const errorHandler = require('./middlewares/errorHandler')
const serverLogs = require('./serverLogs')
const routes = require('./routes')

if (!process.env.ip || !process.env.port) {
  throw new Error('No IP and PORT specified! You need to run the frontend setup first!')
}

serverLogs.logo()

const server = restify.createServer()

server.on('restifyError', errorHandler)

server.use([
  morgan('dev'),
  setContentTypeHeaders,
  setCrossOriginHeaders
])

routes(server)

server.listen(process.env.port, () => {
  serverLogs.start(process.env.port)
})
