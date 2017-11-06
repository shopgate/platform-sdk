/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { red } = require('chalk')
const restify = require('restify')
const morgan = require('morgan')
const request = require('request')
const RapidApi = require('./RapidApi')
const commandApi = require('./commandApi')
const logHelper = require('../LogHelper')
const logger = require('../../../logger')

/**
 * The RapidDevServer class.
 */
class RapidDevServer {
  constructor () {
    this.server = null
    this.rapidUrl = 'https://sgxs-rapid2-dev.shopgate.services'
    this.appId = process.env.appId
    this.rapidApi = new RapidApi(this.rapidUrl, this.appId)
    this.existingServerError = new Error('The RapidDevServer can not be initialized twice!')
    this.noIpPortSuppliedError = new Error('No IP addresses and no API port have been specified. Please run the setup first!')
    this.rapidNotAvailableError = new Error(`RAPID not available!`)
  }

  /**
   * Starts the RapidDevServer.
   */
  start () {
    if (this.server !== null) {
      throw this.existingServerError
    }

    return this.validateEnvironment()
      .then(() => {
        this.createServer()
      })
      .catch((error) => {
        throw error
      })
  }

  /**
   * Creates an instance of the RapidDevServer.
   */
  createServer () {
    try {
      // Display the server logo console output.
      logHelper.logLogo()
      // Create the server.
      this.server = restify.createServer()
      // Handle errors.
      this.setErrorHandlers()
      // Apply middlewares.
      this.setMiddlewares()
      // Attach the routes.
      this.setRoutes(() => {
        // Start the server.
        this.server.listen(process.env.apiPort, () => {
          logHelper.logStartUp()
        })
      })
    } catch (error) {
      throw error
    }
  }

  /**
   * Validates the environment variables
   * @return {Promise}
   */
  validateEnvironment () {
    return new Promise((resolve, reject) => {
      if (!process.env.ip || !process.env.apiPort) {
        return reject(this.noIpPortSuppliedError)
      }

      return resolve()
    })
  }

  /**
   * Sets up the error handling.
   */
  setErrorHandlers () {
    if (this.server === null) {
      return
    }

    this.server.on('restifyError', this.handleRestifyError)
  }

  /**
   * Sets up the server middlewares.
   */
  setMiddlewares () {
    this.server.use([
      morgan('dev'),
      this.setContentTypeHeaders,
      this.setCrossOriginHeaders,
      restify.plugins.bodyParser()
    ])
  }

  /**
   * Sets up the routes.
   * @param {Function} callback Will be triggered at the end of the request.
   */
  setRoutes (callback) {
    // Check the RAPID status.
    request.get(`${this.rapidUrl}/status`, (err, res) => {
      if (err) throw err
      if (res.statusCode !== 200) throw this.rapidNotAvailableError

      logger.plain(`\n  RAPID available. Real data pipeline requests are possible ...`)

      // Create RAPID API.
      this.rapidApi.init(() => {
        // Handle pipeline requests.
        this.server.post('/', this.rapidApi.handle)
        /**
         * Open a special endpoint for WebStorage commands. These are
         * normally processed within the app and not sent to the backend.
         */
        this.server.post('/web_storage', commandApi)

        /**
         * Open a special endpoint for sendHttpRequest commands.
         */
        this.server.post('/http_request', commandApi)
        callback()
      })
    })
  }

  /**
   * Returns and error statement inside an request.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   * @param {Object|string} err The error.
   * @param {Function} next Pass over to the next middleware.
   */
  handleRestifyError (req, res, err, next) {
    if (!err) {
      return next()
    }

    if (!req.xhr) {
      logger.plain(red(err))
      return next()
    }

    res.json(500, {
      status: 500,
      message: 'Something failed!',
      error: err.stack
    })

    next(false)
  }

  /**
   * Reset the headers content type to force utf-8.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   * @param {Function} next Callback to delegate to the next middleware.
   */
  setContentTypeHeaders (req, res, next) {
    if (req.headers['content-type']) {
      req.headers['content-type'] = req.headers['content-type'].replace('utf8', 'utf-8')
    }

    next()
  }

  /**
   * Sets the cross origin headers to allow all origins.
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   * @param {Function} next Callback to delegate to the next middleware.
   */
  setCrossOriginHeaders (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    next()
  }
}

module.exports = new RapidDevServer()
