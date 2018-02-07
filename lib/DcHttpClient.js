const request = require('request')
const UnauthorizedError = require('./errors/UnauthorizedError')
const NotFoundError = require('./errors/NotFoundError')

class DcHttpClient {
  /**
   * @param {UserSettings} userSettings
   * @param {Logger} logger
   */
  constructor (userSettings, logger) {
    this.userSettings = userSettings
    this.logger = logger
    this.dcAddress = process.env.SGCLOUD_DC_ADDRESS || 'https://developer-connector.shopgate.cloud'
  }

  /**
   * @param {String} username
   * @param {String} password
   */
  async login (username, password) {
    const opts = {
      method: 'POST',
      url: `${this.dcAddress}/login`,
      json: true,
      body: {username, password},
      timeout: 2000
    }

    return new Promise((resolve, reject) => {
      request(opts, (err, res, body) => {
        if (err) return reject(err)
        if (res.statusCode !== 200) return reject(new Error(body && body.message ? body.message : 'Login failed'))
        this.userSettings.setToken(body.accessToken).then(() => resolve(), err => reject(err)).catch(err => reject(err))
      })
    })
  }

  /**
   * @param {string} infoType
   * @param {string} appId
   * @param {string} deviceId
   * @param {function} cb
   */
  getInfos (infoType, appId, deviceId, cb) {
    this.userSettings.getToken().then(token => {
      const opts = {
        method: 'GET',
        url: `${this.dcAddress}/applications/${appId}/${infoType}/${deviceId}`,
        json: true,
        timeout: 2000,
        headers: {authorization: 'Bearer ' + token}
      }

      request(opts, async (err, res, body) => {
        if (err) return cb(err)
        if (res.statusCode !== 200) return cb(new Error(body && body.message ? body.message : `could not get ${infoType}`))

        if (res.headers['x-jwt']) {
          this.userSettings.setToken(res.headers['x-jwt']).then(() => {
            cb(null, body)
          })
        } else {
          cb(null, body)
        }
      })
    })
  }

  /**
   * @param {String} applicationId
   * @param {Boolean} trusted
   */
  async downloadPipelines (applicationId, trusted) {
    const token = await this.userSettings.getToken()
    return new Promise((resolve, reject) => {
      const pipelineRoute = trusted ? 'trustedPipelines' : 'pipelines'

      const opts = {
        method: 'GET',
        url: `${this.dcAddress}/applications/${applicationId}/${pipelineRoute}`,
        timeout: 15000,
        json: true,
        headers: {authorization: 'Bearer ' + token}
      }

      request(opts, (err, res, body) => {
        if (err) return reject(err)
        if (res.statusCode === 404) return reject(new Error(`The application with id '${applicationId}' was not found`))
        if (res.statusCode !== 200) return reject(new Error(body && body.message ? body.message : 'Pipeline update failed'))

        if (res.headers['x-jwt']) {
          this.userSettings.setToken(res.headers['x-jwt']).then(() => { resolve(body.pipelines) })
        } else {
          resolve(body.pipelines)
        }
      })
    })
  }

  /**
   * @param {Object} pipeline
   * @param {String} applicationId
   * @param {Boolean} trusted
   * @returns {Promise}
   */
  async uploadPipeline (pipeline, applicationId, trusted) {
    const token = await this.userSettings.getToken()
    return new Promise((resolve, reject) => {
      const pipelineRoute = trusted ? 'trustedPipelines' : 'pipelines'

      const opts = {
        method: 'PUT',
        url: `${this.dcAddress}/applications/${applicationId}/${pipelineRoute}/${pipeline.pipeline.id}`,
        json: true,
        body: pipeline,
        timeout: 15000,
        headers: {authorization: 'Bearer ' + token}
      }

      request(opts, (err, res, body) => {
        if (body) this.logger.debug(body)
        if (err) return reject(err)
        if (res.statusCode !== 204) {
          const err = new Error(body && body.message ? body.message : 'Pipeline update failed')
          if (body && body.code) err.code = body.code
          return reject(err)
        }

        if (res.headers['x-jwt']) {
          this.userSettings.setToken(res.headers['x-jwt']).then(() => { resolve() })
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * @param {Array} pipelines
   * @param {string} applicationId
   * @param {boolean} trusted
   * @returns {Promise}
   */
  uploadMultiplePipelines (pipelines, applicationId, trusted) {
    if (pipelines.length === 0) return Promise.resolve()
    const promises = []
    pipelines.forEach((pipeline) => {
      promises.push(this.uploadPipeline(pipeline, applicationId, trusted))
    })
    return Promise.all(promises)
  }

  /**
   * @param {String} pipelineId
   * @param {String} applicationId
   * @param {Boolean} trusted
   */
  async removePipeline (pipelineId, applicationId, trusted) {
    const token = await this.userSettings.getToken()
    return new Promise((resolve, reject) => {
      const pipelineRoute = trusted ? 'trustedPipelines' : 'pipelines'

      const opts = {
        method: 'DELETE',
        url: `${this.dcAddress}/applications/${applicationId}/${pipelineRoute}/${pipelineId}`,
        json: true,
        timeout: 15000,
        headers: {authorization: 'Bearer ' + token}
      }

      request(opts, (err, res, body) => {
        if (body) this.logger.debug(body)
        if (err) return reject(err)
        if (res.statusCode !== 204) return reject(new Error(body && body.message ? body.message : 'Pipeline removal failed'))

        if (res.headers['x-jwt']) {
          this.userSettings.setToken(res.headers['x-jwt']).then(() => { resolve() })
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * @param {Object} config
   * @param {String} applicationId
   */
  async generateExtensionConfig (config, applicationId) {
    const token = await this.userSettings.getToken()
    return new Promise((resolve, reject) => {
      const opts = {
        method: 'POST',
        url: `${this.dcAddress}/applications/${applicationId}/extensions/${encodeURIComponent(config.id)}/generateConfig`,
        json: true,
        body: config,
        timeout: 15000,
        headers: {authorization: 'Bearer ' + token}
      }

      request(opts, (err, res, body) => {
        if (err) return reject(err)
        if (res.statusCode === 401) return reject(new UnauthorizedError(body.message))
        if (res.statusCode === 404) return reject(new NotFoundError(body.message))
        if (res.statusCode !== 200) return reject(new Error(body && body.message ? body.message : 'Could not generate Extension-Config'))

        if (res.headers['x-jwt']) {
          this.userSettings.setToken(res.headers['x-jwt']).then(() => resolve(body)).catch(err => reject(err))
        } else {
          resolve(body)
        }
      })
    })
  }

  setStartPageUrl (applicationId, startPageUrl, cb) {
    this.userSettings.getToken().then(token => {
      const opts = {
        method: 'PUT',
        url: `${this.dcAddress}/applications/${applicationId}/settings/startpage`,
        json: true,
        body: {startPageUrl},
        timeout: 5000,
        headers: {authorization: 'Bearer ' + token}
      }
      request(opts, (err, res, body) => {
        if (body) this.logger.debug(body)
        if (err) return cb(err)
        if (res.statusCode !== 204) return cb(new Error(body && body.message ? body.message : 'Setting start page url failed'))

        if (res.headers['x-jwt']) {
          this.userSettings.setToken(res.headers['x-jwt']).then(() => cb(null)).catch(err => cb(err))
        } else {
          cb(null)
        }
      })
    })
  }

  /**
   * @param {string} applicationId
   *
   * @returns {Promise<string>} The response body from developer connector.
   */
  async getApplicationData (applicationId) {
    const token = await this.userSettings.getToken()

    const opts = {
      method: 'GET',
      url: `${this.dcAddress}/applications/${applicationId}`,
      json: true,
      timeout: 5000,
      headers: {
        authorization: 'Bearer ' + token
      }
    }

    return new Promise((resolve, reject) => {
      request(opts, (err, res, body) => {
        if (err) return reject(err)
        if (res.statusCode === 401) return reject(new UnauthorizedError(body.message))
        if (res.statusCode !== 200) return reject(new Error(body && body.message ? body.message : 'Getting application data failed'))

        if (res.headers['x-jwt']) {
          this.userSettings.setToken(res.headers['x-jwt']).then(() => resolve(body)).catch(err => reject(err))
        } else {
          resolve(body)
        }
      })
    })
  }
}

module.exports = DcHttpClient
