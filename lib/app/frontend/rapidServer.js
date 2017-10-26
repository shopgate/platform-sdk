const restify = require('restify')
const morgan = require('morgan')
const setContentTypeHeaders = require('./middlewares/setContentTypeHeaders')
const setCrossOriginHeaders = require('./middlewares/setCrossOriginHeaders')
const errorHandler = require('./middlewares/errorHandler')
const serverLogs = require('./serverLogs')

serverLogs.logo()

const server = restify.createServer()

server.on('restifyError', errorHandler)

server.use([
  morgan('dev'),
  setContentTypeHeaders,
  setCrossOriginHeaders
])

server.post('/', (req, res) => {
  res.send('Pipeline Request')
  res.end()
})

const PORT = 9666

server.listen(PORT, () => {
  serverLogs.start(PORT)
})
