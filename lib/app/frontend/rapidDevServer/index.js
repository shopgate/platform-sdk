/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const restify = require('restify')
const morgan = require('morgan')
const setContentTypeHeaders = require('./middlewares/setContentTypeHeaders')
const setCrossOriginHeaders = require('./middlewares/setCrossOriginHeaders')
const errorHandler = require('./middlewares/errorHandler')
const Logger = require('../Logger')
const routes = require('./routes')

const logger = Logger.getInstance()

// Stop the process if IP and Port are missing.
if (!process.env.ip || !process.env.port) {
  logger.logError('No IP addresses and no port have been specified. Please run the setup first!')
  process.exit(1)
}

// Display the server logo console output.
logger.logLogo()

// Create the server.
const server = restify.createServer()

// Handle errors.
server.on('restifyError', errorHandler)

// Apply middleware.
server.use([
  morgan('dev'),
  setContentTypeHeaders,
  setCrossOriginHeaders,
  restify.plugins.bodyParser()
])

// Attach the routes.
routes(server)

// Start the server.
server.listen(process.env.port, () => {
  logger.logStartUp()
})
