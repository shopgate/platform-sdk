/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const request = require('request')
const appStartCommand = require('./appStart.json')

class RapidApi {
  /**
   * Set the settings necessary to send requests to the RAPID.
   * @param {Object} options Settings for requesting the RAPID
   * @param {string} options.url Endpoint of the RAPID that processes the http requests
   * @param {string} options.shopNumber Number of the shop for which the request should be made
   * @param {string} options.sessionId SessionId from cake (required e.g. for getting prices)
   * @param {string} options.deviceId Device identifier necessary for pipelines to access storages
   */
  constructor ({ url, shopNumber, callback = () => {} }) {
    this.settings = { url, shopNumber }

    this.requestIds((error, sessionId, deviceId) => {
      if (error) {
        throw error
      }

      this.setIds(sessionId, deviceId)

      console.log(`    STACK: ${url}`)
      console.log(`    SHOP:  ${shopNumber.replace('shop_', '')}`)
      console.log(`  RAPID connecting established!\n`)

      callback()
    })

    this.handle = this.handle.bind(this)
  }

  /**
   * Adds the sessionId and the deviceId to the settins.
   * @param {string} sessionId The session ID.
   * @param {string} deviceId The device ID.
   * @returns {RapidApi}
   */
  setIds (sessionId, deviceId) {
    this.settings = {
      ...this.settings,
      sessionId,
      deviceId
    }

    return this
  }

  /**
   * Returns the settings.
   * @return {Object}
   */
  getSettings () {
    return this.settings
  }

  /**
   * Returns the request headers for a backend request.
   * @param {Object} [addons={}] Additional headers.
   * @return {Object} The request headers.
   */
  getRequestHeaders (addons = {}) {
    return {
      'sg-application-id': this.getSettings().shopNumber,
      'accept-encoding': 'plain',
      'sg-device-type': 'android-phone',
      'sg-api-codebase': '5.16.0',
      'accept-version': '~1',
      ...addons
    }
  }

  /**
   * Get sessionId and deviceId by sending an appStart to the RAPID
   * @param {string} url Endpoint of the RAPID
   * @param {string} shopNumber Number of the shop that the request are for
   * @param {Function} cb Callback
   */
  requestIds (callback) {
    appStartCommand.p.appIdentifier = this.getSettings().shopNumber.replace(':', '_')

    const params = {
      url: this.settings.url,
      headers: this.getRequestHeaders(),
      json: true,
      body: {
        cmds: [ appStartCommand ],
        ver: '1.2'
      }
    }

    request.post(params, (err, res, body) => {
      if (err) return callback(err)
      if (!body || !body.cmds) return callback(new Error('No response commands from rapid'))

      return callback(null, body.cmds[0].p.value, res.headers['sg-device-id'])
    })
  }

  /**
   * Forwards the request to the new rapid
   * @param {Object} req The request object.
   * @param {Object} res The response object.
   */
  handle (req, res) {
    try {
      req.body.vars = { sid: this.getSettings().sessionId }

      // Transform a 'sendPipelineRequest' to a 'pipelineRequest' command.
      if (req.body.cmds[0].c === 'sendPipelineRequest') {
        req.body.cmds[0].c = 'pipelineRequest'
      }

      // Set a default lib version if none is set in the request.
      if (!req.body.ver) {
        req.body.ver = '9.0'
      }

      // Set the request params.
      const params = {
        url: this.settings.url,
        headers: this.getRequestHeaders({
          'sg-device-id': this.settings.deviceId
        }),
        body: req.body,
        json: true
      }

      // Send the RAPID request.
      request.post(params, (error, response, body) => {
        if (error) {
          console.error(error)
          return res.status(500).send('Could not connect to RAPID. Please try again later.')
        }

        if (response.statusCode !== 200) {
          const errMsg = body ? (body.errors || body.message) : 'Did not get 200 response from RAPID.'
          return res.status(response.statusCode).send(errMsg)
        }

        return res.json(body)
      })
    } catch (error) {
      console.error(error)
    }
  }
}

module.exports = RapidApi
