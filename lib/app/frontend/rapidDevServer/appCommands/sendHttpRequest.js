/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const request = require('request')

// Create a cookie jar to have persistent cookies during a dev server session
const cookieJar = request.jar()

/**
 * Handler for the sendHttpRequest command
 * @param {Object} parameters The command parameters
 * @param {Function} callback Callback for the response command
 */
module.exports = (parameters, callback) => {
  const defaults = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
    },
    jar: cookieJar
  }

  const options = {
    ...defaults,
    ...parameters
  }

  if (options.contentType) {
    // Move the content type parameter to the headers
    options.headers['Content-Type'] = options.contentType
    delete options.contentType
  }

  if (typeof options.followRedirects !== 'undefined') {
    // Translate the "followRedirects" parameter
    options.followRedirect = options.followRedirects
    delete options.followRedirects
  }

  request(options, (error, response, body) => {
    const { serial } = options
    let commandResponse = null

    if (!error) {
      const { headers, statusCode } = response

      // Prepare the response command parameters
      commandResponse = {
        body,
        headers,
        statusCode
      }
    }

    // Prepare the response command
    const command = {
      c: 'httpResponse',
      p: {
        error,
        serial,
        response: commandResponse
      }
    }

    callback(null, command)
  })
}
