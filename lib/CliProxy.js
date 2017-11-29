const request = require('request')
const restify = require('restify')

const logger = require('./logger')
const AppSettings = require('./app/AppSettings')
const RAPID_URL = 'https://sgxs-rapid2-dev.shopgate.services'
const RAPID_PORT = 8090

const defaultHeader = {
  'sg-api-codebase': '5.16.0',
  'sg-device-type': 'android-phone',
  'accept-encoding': 'plain',
  'content-type': 'application/json',
  'accept-version': '~1'
}

const appStartCommand = {
  'c': 'appStart',
  'p': {
    'apiKey': 'testTesttest',
    'appIdentifier': 'shop:0',
    'appVersion': '5.16.0',
    'codebase': '5.16.0',
    'device': {
      'cameras': [],
      'carrier': 'testCarrier',
      'locale': 'de',
      'model': 'testModel',
      'os': {
        'apiLevel': '24',
        'platform': 'android',
        'ver': '7.0'
      },
      'screen': {
        'height': 1184,
        'scale': 2,
        'width': 720
      },
      'type': 'phone'
    },
    'isDevelopmentApp': true
  }
}

const pipelineCommand = {
  'c': 'pipelineRequest',
  'p': {
    'name': null,
    'input': null
  }
}

class CliProxy {
  start (cb) {
    const shopId = AppSettings.getInstance().getId().split('_')

    this._getIdsFromRapid(RAPID_URL, shopId[1], (err, ids) => {
      if (err) return cb(err)
      this._startPipelineServer(RAPID_PORT, RAPID_URL, ids.sessionId, ids.deviceId, shopId[1], 'Pipelines', cb)
    })
  }

  /**
   * Fetches session and deviceId from Rapid
   * @param rapidUrl
   * @param shopNumber
   * @param cb
   * @private
   */
  _getIdsFromRapid (rapidUrl, shopNumber, cb) {
    appStartCommand.p.appIdentifier = `shop:${shopNumber}`

    const headers = {
      'sg-application-id': `shop_${shopNumber}`
    }
    Object.assign(headers, defaultHeader)
    const params = {
      url: rapidUrl,
      method: 'POST',
      headers,
      body: {
        cmds: [appStartCommand],
        ver: '1.2'
      },
      json: true,
      resolveWithFullResponse: true
    }
    request(params, (err, res, body) => {
      if (err) cb(err)
      if (!CliProxy._objectPathExists(res, 'body', 'cmds', 0, 'p', 'value') ||
          !CliProxy._objectPathExists(res, 'headers', 'sg-device-id')) {
        return cb(new Error('No response commands or no deviceId in header from rapid'))
      }
      cb(null, {
        sessionId: res.body.cmds[0].p.value,
        deviceId: res.headers['sg-device-id']
      })
    })
  }

  /**
   * Starts a new pipelineserver
   * @param port
   * @param rapidUrl
   * @param sessionId
   * @param deviceId
   * @param shopNumber
   * @param name
   * @param cb
   * @return {Promise}
   */
  _startPipelineServer (port, rapidUrl, sessionId, deviceId, shopNumber, name, cb) {
    const server = restify.createServer()

    server.use(restify.plugins.bodyParser({mapParams: false}))

    server.get('/status', (req, res) => res.send({status: 'is running'}))
    server.post('/pipelines/.*', this._getPipelineHandlerFunction(rapidUrl, sessionId, deviceId, shopNumber, false))
    server.post('/trustedPipelines/.*', this._getPipelineHandlerFunction(rapidUrl, sessionId, deviceId, shopNumber, true))

    server.listen(port, () => {
      logger.info(`${name} proxy is listening on ${port}`)
      cb(null, server)
    })
  }

  _getPipelineHandlerFunction (rapidUrl, sessionId, deviceId, shopNumber, trusted) {
    /**
     * Forwards the request to the new rapid
     * @param {Object} req The request object.
     * @param {Object} res The response object.
     */
    return (req, res, next) => {
      const cmd = Object.assign({}, pipelineCommand)
      if (trusted) {
        cmd.p.type = 'trusted'
        cmd.p.name = req.url.replace('/trustedPipelines/', '')
      } else {
        cmd.p.type = 'normal'
        cmd.p.name = req.url.replace('/pipelines/', '')
      }
      cmd.p.input = req.body

      const body = {
        ver: '9.0',
        vars: { sid: sessionId },
        cmds: [cmd]
      }

      const headers = {
        'sg-application-id': `shop_${shopNumber}`,
        'sg-device-id': deviceId
      }
      Object.assign(headers, defaultHeader)

      const params = {
        url: rapidUrl,
        method: 'POST',
        headers,
        body,
        json: true,
        resolveWithFullResponse: true
      }
      return this._doRequest(params, res, next)
    }
  }

  /**
   * Check that the supplied arguments form a valid path in the object
   * @param {Object} obj
   * @param {...*} path
   * @returns {boolean}
   */
  static _objectPathExists (obj, ...path) {
    for (let i = 0; i < path.length; i++) {
      if (!obj || !obj.hasOwnProperty(path[i])) {
        return false
      }
      obj = obj[path[i]]
    }
    return true
  }

  /**
   * Does actual proxy request to the rapid server
   * @param {object} params
   * @param {object} res
   * @param next
   */
  _doRequest (params, res, next) {
    request(params, (err, response) => {
      if (err) {
        res.json(500, 'Could not connect to rapid')
        return next()
      }
      if (response.statusCode !== 200) {
        const errMsg = response.body ? (response.body.errors || response.body.message) : 'Did not get 200 response from Rapid.'
        res.json(response.statusCode, errMsg)
        return next()
      }
      return res.json(response.body)
    })
  }
}

module.exports = CliProxy
