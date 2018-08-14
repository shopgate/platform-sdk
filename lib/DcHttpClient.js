const requestp = require('request-promise-native')
const UnauthorizedError = require('./errors/UnauthorizedError')
const NotFoundError = require('./errors/NotFoundError')

// @ts-check
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
   * @returns {Promise<void>}
   */
  async login (username, password) {
    const opts = {
      method: 'POST',
      url: `${this.dcAddress}/login`,
      json: true,
      body: { username, password },
      timeout: 2000,
      resolveWithFullResponse: true,
      simple: false
    }

    const response = await requestp(opts)
    if (response.statusCode !== 200) throw new Error(response.body && response.body.message ? response.body.message : 'Login failed')
    if (!response.body.accessToken) throw new Error('Invalid response from Developer Connector: ' + JSON.stringify(response.body))

    await this.userSettings.setToken(response.body.accessToken)
  }

  /**
   * @param {string} infoType
   * @param {string} appId
   * @param {string} deviceId
   * @returns {Promise<void>}
   */
  async getInfos (infoType, appId, deviceId) {
    const token = await this.userSettings.getToken()
    const opts = {
      method: 'GET',
      url: `${this.dcAddress}/applications/${appId}/${infoType}/${deviceId}`,
      json: true,
      timeout: 2000,
      headers: { authorization: 'Bearer ' + token },
      resolveWithFullResponse: true,
      simple: false
    }

    const response = await requestp(opts)
    if (response.statusCode !== 200) throw new Error(response.body && response.body.message ? response.body.message : `could not get ${infoType}`)

    if (response.headers['x-jwt']) {
      await this.userSettings.setToken(response.headers['x-jwt'])
    }

    return response.body
  }

  /**
   * @param {String} applicationId
   * @param {Boolean} trusted
   * @param {Boolean} resolved
   */
  async downloadPipelines (applicationId, trusted, resolved, attached) {
    const token = await this.userSettings.getToken()
    const pipelineRoute = trusted ? 'trustedPipelines' : 'pipelines'

    const opts = {
      method: 'GET',
      url: `${this.dcAddress}/applications/${applicationId}/${pipelineRoute}`,
      qs: {
        resolveHooks: resolved,
        attachedExtensions: attached.join(',')
      },
      timeout: 15000,
      json: true,
      headers: { authorization: 'Bearer ' + token },
      resolveWithFullResponse: true,
      simple: false
    }

    let response
    try {
      response = await requestp(opts)
    } catch (err) {
      throw err
    }

    if (response.statusCode === 404) throw new Error(`The application with id '${applicationId}' was not found`)
    if (response.statusCode !== 200) {
      let additionalInfo
      if (response.body && response.body.message) additionalInfo = response.body.message
      if (response.body && response.body.causingError) additionalInfo = response.body.causingError.message
      throw new Error(`Pipeline download failed${additionalInfo ? `: ${additionalInfo}` : ''}`)
    }

    if (response.headers['x-jwt']) {
      await this.userSettings.setToken(response.headers['x-jwt'])
    }

    if (!response.body.pipelines) response.body.pipelines = []
    return response.body
  }

  /**
   * @param {PipelineJson} pipeline
   * @param {String} applicationId
   * @param {Boolean} trusted
   * @returns {Promise}
   */
  async uploadPipeline (pipeline, applicationId, trusted) {
    const token = await this.userSettings.getToken()

    const pipelineRoute = trusted ? 'trustedPipelines' : 'pipelines'

    const opts = {
      method: 'PUT',
      url: `${this.dcAddress}/applications/${applicationId}/${pipelineRoute}/${pipeline.pipeline.id}`,
      json: true,
      body: pipeline,
      timeout: 15000,
      headers: { authorization: 'Bearer ' + token },
      resolveWithFullResponse: true,
      simple: false
    }

    const response = await requestp(opts)
    if (response.statusCode !== 204) {
      const error = new Error(response.body && response.body.message ? response.body.message : 'Pipeline update failed')
      if (response.body.code) error.code = response.body.code

      throw error
    }

    if (response.headers['x-jwt']) {
      await this.userSettings.setToken(response.headers['x-jwt'])
    }
  }

  /**
   * @param {Object<string, PipelineJson>} pipelines
   * @param {string} applicationId
   * @param {boolean} trusted
   * @returns {Promise}
   */
  async uploadMultiplePipelines (pipelines, applicationId, trusted) {
    if (pipelines.length === 0) return

    return Promise.all(pipelines.map((pipeline) => this.uploadPipeline(pipeline, applicationId, trusted)))
  }

  /**
   * @param {String} pipelineId
   * @param {String} applicationId
   * @param {Boolean} trusted
   */
  async removePipeline (pipelineId, applicationId, trusted) {
    const token = await this.userSettings.getToken()
    const pipelineRoute = trusted ? 'trustedPipelines' : 'pipelines'

    const opts = {
      method: 'DELETE',
      url: `${this.dcAddress}/applications/${applicationId}/${pipelineRoute}/${pipelineId}`,
      json: true,
      timeout: 15000,
      headers: { authorization: 'Bearer ' + token },
      resolveWithFullResponse: true,
      simple: false
    }

    const response = await requestp(opts)
    if (response.body) this.logger.debug(response.body)

    if (response.statusCode !== 204) {
      const error = new Error(response.body && response.body.message ? response.body.message : 'Pipeline removal failed')
      if (response.body.code) error.code = response.body.code

      throw error
    }

    if (response.headers['x-jwt']) {
      await this.userSettings.setToken(response.headers['x-jwt'])
    }
  }

  /**
   * @param {ExtensionConfigJson} config
   * @param {String} applicationId
   */
  async generateExtensionConfig (config, applicationId) {
    const token = await this.userSettings.getToken()
    const opts = {
      method: 'POST',
      url: `${this.dcAddress}/applications/${applicationId}/extensions/${encodeURIComponent(config.id)}/generateConfig`,
      json: true,
      body: config,
      timeout: 15000,
      headers: { authorization: 'Bearer ' + token },
      resolveWithFullResponse: true,
      simple: false
    }

    const response = await requestp(opts)

    if (response.statusCode === 401) throw new UnauthorizedError(response.body.message)
    if (response.statusCode === 404) throw new NotFoundError(response.body.message)

    if (response.statusCode === 400 && response.body && response.body.errors) {
      let message = 'Could not generate Extension-Config'
      for (const error of response.body.errors) {
        message += `\nField ${error.field}: ${error.message}`
      }
      throw new Error(message)
    }

    if (response.statusCode !== 200) {
      let additionalInfo
      if (response.body && response.body.message) additionalInfo = response.body.message
      if (response.body && response.body.causingError) additionalInfo = response.body.causingError.message
      throw new Error(`Could not generate Extension-Config${additionalInfo ? `: ${additionalInfo}` : ''}`)
    }

    if (response.headers['x-jwt']) {
      await this.userSettings.setToken(response.headers['x-jwt'])
    }

    return response.body
  }

  async setStartPageUrl (applicationId, startPageUrl) {
    const token = await this.userSettings.getToken()

    const opts = {
      method: 'PUT',
      url: `${this.dcAddress}/applications/${applicationId}/settings/startpage`,
      json: true,
      body: { startPageUrl },
      timeout: 5000,
      headers: { authorization: 'Bearer ' + token },
      resolveWithFullResponse: true,
      simple: false
    }

    const response = await requestp(opts)
    if (response.body) this.logger.debug(response.body)
    if (response.statusCode !== 204) throw new Error(response.body && response.body.message ? response.body.message : 'Setting start page url failed')

    if (response.headers['x-jwt']) {
      await this.userSettings.setToken(response.headers['x-jwt'])
    }
  }

  async clearHooks (applicationId) {
    const token = await this.userSettings.getToken()

    const opts = {
      method: 'DELETE',
      url: `${this.dcAddress}/applications/${applicationId}/hooks`,
      json: true,
      headers: {
        authorization: 'Bearer ' + token
      },
      resolveWithFullResponse: true
    }

    const response = await requestp(opts)
    if (response.statusCode === 401) throw new UnauthorizedError(response.body.message)
    if (response.statusCode !== 204) throw new Error(response.body && response.body.message ? response.body.message : 'Pushing hooks failed')

    if (response.headers['x-jwt']) {
      await this.userSettings.setToken(response.headers['x-jwt'])
    }

    return response.body
  }

  async pushHooks (config, applicationId) {
    const token = await this.userSettings.getToken()
    const extensionId = config.id

    if (!config.steps) return

    const hooks = config.steps.filter(step => (step.hooks && step.hooks.length > 0)).map(hook => {
      hook.trusted = !!config.trusted
      return hook
    })

    if (hooks.length > 0) {
      const opts = {
        method: 'PUT',
        url: `${this.dcAddress}/applications/${applicationId}/extensions/${encodeURIComponent(extensionId)}/hooks`,
        json: true,
        headers: {
          authorization: 'Bearer ' + token
        },
        body: hooks,
        resolveWithFullResponse: true
      }

      let response
      try {
        response = await requestp(opts)
      } catch (error) {
        throw new Error(`Could not push hooks for ${extensionId} : ${error.message}`)
      }

      if (response.statusCode === 401) throw new UnauthorizedError(response.body.message)
      if (response.statusCode !== 204) throw new Error(response.body && response.body.message ? response.body.message : 'Pushing hooks failed')

      if (response.headers['x-jwt']) {
        await this.userSettings.setToken(response.headers['x-jwt'])
      }

      return response.body
    }
    return Promise.resolve()
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
      headers: { authorization: 'Bearer ' + token },
      resolveWithFullResponse: true,
      simple: false
    }

    const response = await requestp(opts)
    if (response.statusCode === 401) throw new UnauthorizedError(response.body.message)
    if (response.statusCode !== 200) throw new Error(response.body && response.body.message ? response.body.message : 'Getting application data failed')

    if (response.headers['x-jwt']) {
      await this.userSettings.setToken(response.headers['x-jwt'])
    }

    return response.body
  }
}

module.exports = DcHttpClient
