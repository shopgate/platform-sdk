const request = require('request')
const UnauthorizedError = require('./errors/UnauthorizedError')

class DcHttpClient {
  constructor (userSettings, logger) {
    this.userSettings = userSettings
    this.logger = logger
    this.dcAddress = process.env.SGCLOUD_DC_ADDRESS || 'https://developer-connector.shopgate.cloud'
  }

  /**
   * @param {String} username
   * @param {String} password
   * @param {Function} cb
   */
  login (username, password, cb) {
    const opts = {
      method: 'POST',
      url: `${this.dcAddress}/login`,
      json: true,
      body: {username, password},
      timeout: 2000
    }

    request(opts, (err, res, body) => {
      if (err) return cb(err)
      if (res.statusCode !== 200) return cb(new Error(body && body.message ? body.message : 'Login failed'))

      this.userSettings.setToken(body.accessToken)
      cb()
    })
  }

  /**
   * @param {string} infoType
   * @param {string} appId
   * @param {string} deviceId
   * @param {function} cb
   */
  getInfos (infoType, appId, deviceId, cb) {
    const opts = {
      method: 'GET',
      url: `${this.dcAddress}/applications/${appId}/${infoType}/${deviceId}`,
      json: true,
      timeout: 2000,
      headers: {authorization: 'Bearer ' + this.userSettings.getToken()}
    }

    request(opts, (err, res, body) => {
      if (err) return cb(err)
      if (res.statusCode !== 200) return cb(new Error(body && body.message ? body.message : `could not get ${infoType}`))

      if (res.headers['x-jwt']) this.userSettings.setToken(res.headers['x-jwt'])
      cb(null, body)
    })
  }

  /**
   * @param {String} applicationId
   * @param {Boolean} trusted
   * @param {Function} cb
   */
  downloadPipelines (applicationId, trusted, cb) {
    const pipelineRoute = trusted ? 'trustedPipelines' : 'pipelines'

    const opts = {
      method: 'GET',
      url: `${this.dcAddress}/applications/${applicationId}/${pipelineRoute}`,
      timeout: 15000,
      json: true,
      headers: {authorization: 'Bearer ' + this.userSettings.getToken()}
    }

    request(opts, (err, res, body) => {
      if (err) return cb(err)
      if (res.statusCode === 404) return cb(new Error(`The application with id '${applicationId}' was not found`))
      if (res.statusCode !== 200) return cb(new Error(body && body.message ? body.message : 'Pipeline update failed'))

      if (res.headers['x-jwt']) this.userSettings.setToken(res.headers['x-jwt'])
      cb(null, body.pipelines)
    })
  }

  /**
   * @param {Object} pipeline
   * @param {String} applicationId
   * @param {Function} cb
   */
  uploadPipeline (pipeline, applicationId, trusted, cb) {
    const pipelineRoute = trusted ? 'trustedPipelines' : 'pipelines'

    const opts = {
      method: 'PUT',
      url: `${this.dcAddress}/applications/${applicationId}/${pipelineRoute}/${pipeline.pipeline.id}`,
      json: true,
      body: pipeline,
      timeout: 15000,
      headers: {authorization: 'Bearer ' + this.userSettings.getToken()}
    }

    request(opts, (err, res, body) => {
      if (body) this.logger.debug(body)
      if (err) return cb(err)
      if (res.statusCode !== 204) {
        const err = new Error(body && body.message ? body.message : 'Pipeline update failed')
        if (body && body.code) err.code = body.code
        return cb(err)
      }

      if (res.headers['x-jwt']) this.userSettings.setToken(res.headers['x-jwt'])
      cb()
    })
  }

  /**
   * @param {String} pipelineId
   * @param {String} applicationId
   * @param {Boolean} trusted
   * @param {Function} cb
   */
  removePipeline (pipelineId, applicationId, trusted, cb) {
    const pipelineRoute = trusted ? 'trustedPipelines' : 'pipelines'

    const opts = {
      method: 'DELETE',
      url: `${this.dcAddress}/applications/${applicationId}/${pipelineRoute}/${pipelineId}`,
      json: true,
      timeout: 15000,
      headers: {authorization: 'Bearer ' + this.userSettings.getToken()}
    }

    request(opts, (err, res, body) => {
      if (body) this.logger.debug(body)
      if (err) return cb(err)
      if (res.statusCode !== 204) return cb(new Error(body && body.message ? body.message : 'Pipeline removal failed'))

      if (res.headers['x-jwt']) this.userSettings.setToken(res.headers['x-jwt'])
      cb()
    })
  }

  /**
   *
   * @param {Object} config
   * @param {String} applicationId
   * @param {Function} cb
   */
  generateExtensionConfig (config, applicationId, cb) {
    const opts = {
      method: 'POST',
      url: `${this.dcAddress}/applications/${applicationId}/extensions/${encodeURIComponent(config.id)}/generateConfig`,
      json: true,
      body: config,
      timeout: 15000,
      headers: {authorization: 'Bearer ' + this.userSettings.getToken()}
    }

    request(opts, (err, res, body) => {
      if (err) return cb(err)
      if (res.statusCode !== 200) return cb(new Error(body && body.message ? body.message : 'Could not generate Extension-Config'))

      if (res.headers['x-jwt']) this.userSettings.setToken(res.headers['x-jwt'])
      cb(null, body)
    })
  }

  setStartPageUrl (applicationId, startPageUrl, cb) {
    const opts = {
      method: 'PUT',
      url: `${this.dcAddress}/applications/${applicationId}/settings/startpage`,
      json: true,
      body: {startPageUrl},
      timeout: 5000,
      headers: {authorization: 'Bearer ' + this.userSettings.getToken()}
    }
    request(opts, (err, res, body) => {
      if (body) this.logger.debug(body)
      if (err) return cb(err)
      if (res.statusCode !== 204) return cb(new Error(body && body.message ? body.message : 'Setting start page url failed'))

      if (res.headers['x-jwt']) this.userSettings.setToken(res.headers['x-jwt'])
      cb()
    })
  }

  getApplicationData (applicationId, cb) {
    const opts = {
      method: 'GET',
      url: `${this.dcAddress}/applications/${applicationId}`,
      json: true,
      timeout: 5000,
      headers: {
        authorization: 'Bearer ' + this.userSettings.getToken()
      }
    }
    request(opts, (err, res, body) => {
      if (err) return cb(err)
      if (res.statusCode === 401) return cb(new UnauthorizedError(body.message))
      if (res.statusCode !== 200) return cb(new Error(body && body.message ? body.message : 'Getting application data failed'))
      cb(null, body)
    })
  }
}

module.exports = DcHttpClient
