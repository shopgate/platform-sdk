const restify = require('restify')
const morgan = require('morgan')
const setContentTypeHeaders = require('./middlewares/setContentTypeHeaders')
const setCrossOriginHeaders = require('./middlewares/setCrossOriginHeaders')
const errorHandler = require('./middlewares/errorHandler')
const serverLogs = require('./serverLogs')
const routes = require('./routes')

serverLogs.logo()

const server = restify.createServer()

server.on('restifyError', errorHandler)

server.use([
  morgan('dev'),
  setContentTypeHeaders,
  setCrossOriginHeaders
])

routes(server)

const PORT = 9666

server.listen(PORT, () => {
  serverLogs.start(PORT)
})
