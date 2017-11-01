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
const LogHelper = require('../LogHelper')
const logger = require('../../../logger')
const routes = require('./routes')

const logHelper = LogHelper.getInstance()

// Stop the process if IP and Port are missing.
if (!process.env.ip || !process.env.apiPort) {
  logger.error('No IP addresses and no API port have been specified. Please run the setup first!')
  process.exit(1)
}

// Display the server logo console output.
logHelper.logLogo()

// Create the server.
const server = restify.createServer()

// Handle errors.
server.on('restifyError', errorHandler)

// Apply middlewares.
server.use([
  morgan('dev'),
  setContentTypeHeaders,
  setCrossOriginHeaders,
  restify.plugins.bodyParser()
])

// Attach the routes.
routes(server)

// Start the server.
server.listen(process.env.apiPort, () => {
  logHelper.logStartUp()
})
