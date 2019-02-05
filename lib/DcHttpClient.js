const { STATUS_CODES } = require('http')
const fsEx = require('fs-extra')
const request = require('request')
const requestp = require('request-promise-native')
const { NotFoundError, UnauthorizedError, ConflictError } = require('./errors')
const t = require('./i18n')(__filename)

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
   * @param {Object} options
   * @param {String} options.url
   * @param {String} [options.method]
   * @param {Object} [options.body]
   */
  async _dcRequest (options = {}) {
    const token = await this.userSettings.getToken()
    const opts = Object.assign({
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
      json: true,
      resolveWithFullResponse: true,
      simple: false
    }, options, { baseUrl: this.dcAddress })
    const response = await requestp(opts)
    await this._handleDcResponse(response)
    return response
  }

  /**
   * @param {Object} response
   * @param {Object} response.headers
   * @param {String|Number} response.statusCode
   * @param {Object} [response.body]
   */
  async _handleDcResponse ({ headers = {}, statusCode, body = {} }) {
    if (headers['x-jwt']) {
      await this.userSettings.setToken(headers['x-jwt'])
    }

    switch (statusCode) {
      case 401:
        throw new UnauthorizedError(body)
      case 404:
        throw new NotFoundError(body)
      case 409:
        throw new ConflictError(body)
      default:
        if (statusCode >= 400) throw new Error(body.message || STATUS_CODES[statusCode])
    }
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
    if (response.statusCode !== 200) throw new Error(response.body && response.body.message ? response.body.message : t('ERROR_LOGIN_FAILED'))
    if (!response.body.accessToken) throw new Error(t('ERROR_INVALID_DC_RESPONSE', { response: JSON.stringify(response.body) }))

    await this.userSettings.setToken(response.body.accessToken)
  }

  async checkPermissions (applicationId) {
    const token = await this.userSettings.getToken()

    const opts = {
      method: 'GET',
      url: `${this.dcAddress}/applications/${applicationId}`,
      json: true,
      headers: { authorization: 'Bearer ' + token },
      resolveWithFullResponse: true,
      simple: false
    }

    const response = await requestp(opts)

    if (response.statusCode === 403 && response.body.code === 'Forbidden') throw new UnauthorizedError({ message: t('ERROR_NO_ACCESS_TO_APP') })

    if (response.headers['x-jwt']) {
      await this.userSettings.setToken(response.headers['x-jwt'])
    }
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
    if (response.statusCode !== 200) throw new Error(response.body && response.body.message ? response.body.message : t('ERROR_COULD_NOT_GET', { infoType }))

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

    if (response.statusCode === 404) throw new Error(t('ERROR_APP_NOT_FOUND', { applicationId }))
    if (response.statusCode !== 200) {
      let additionalInfo
      if (response.body && response.body.message) additionalInfo = response.body.message
      throw new Error(additionalInfo ? t('ERROR_PIPELINE_DOWNLOAD_FAILED_INFO', { additionalInfo }) : t('ERROR_PIPELINE_DOWNLOAD_FAILED'))
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
      const error = new Error(response.body && response.body.message ? response.body.message : t('ERROR_PIPELINE_UPDATE_FAILED'))
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
      const error = new Error(response.body && response.body.message ? response.body.message : t('ERROR_PIPELINE_REMOVAL_FAILED'))
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

    if (response.statusCode === 400 && response.body && response.body.errors) {
      let additionalInfo = ''
      for (const error of response.body.errors) {
        additionalInfo += `\nField ${error.field}: ${error.message}`
      }
      throw new Error(additionalInfo ? t('ERROR_GENERATE_EXT_CONFIG_INFO', { additionalInfo }) : t('ERROR_GENERATE_EXT_CONFIG'))
    }

    if (response.statusCode >= 400) {
      let additionalInfo
      if (response.body && response.body.message) additionalInfo = response.body.message
      throw new Error(additionalInfo ? t('ERROR_GENERATE_EXT_CONFIG_INFO', { additionalInfo }) : t('ERROR_GENERATE_EXT_CONFIG'))
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
    if (response.statusCode !== 204) throw new Error(response.body && response.body.message ? response.body.message : t('ERROR_SET_START_PAGE_FAILED'))

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
    if (response.statusCode === 401) throw new UnauthorizedError(response.body)
    if (response.statusCode !== 204) throw new Error(response.body && response.body.message ? response.body.message : t('ERROR_PUSH_HOOKS_FAILED'))

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
        throw new Error(t('ERROR_PUSH_HOOKS_FOR_EXT_FAILED', { extensionId, message: error.message }))
      }

      if (response.statusCode === 401) throw new UnauthorizedError(response.body)
      if (response.statusCode !== 204) throw new Error(response.body && response.body.message ? response.body.message : t('ERROR_PUSH_HOOKS_FAILED'))

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
    if (response.statusCode === 401) throw new UnauthorizedError(response.body)
    if (response.statusCode !== 200) throw new Error(response.body && response.body.message ? response.body.message : t('ERROR_GET_APP_DATA_FAILED'))

    if (response.headers['x-jwt']) {
      await this.userSettings.setToken(response.headers['x-jwt'])
    }

    return response.body
  }

  /**
   * @param {String} extensionId
   * @param {String} extensionVersion
   * @returns {Promise<Object>}
   */
  async getExtensionVersion (extensionId, extensionVersion) {
    const { body } = await this._dcRequest({
      url: `/extensions/${encodeURIComponent(extensionId)}/versions/${encodeURIComponent(extensionVersion)}`
    })

    return body
  }

  /**
   * @param {String} extensionId
   * @param {String} extensionVersion
   * @param {String} filePath
   * @param {Object} [options]
   * @param {Boolean} [options.forceVersionCreate]
   * @param {Boolean} [options.cancelReview]
   * @returns {Promise}
   */
  async uploadExtensionFile (extensionId, extensionVersion, filePath, options = {}) {
    const token = await this.userSettings.getToken()
    const {
      forceVersionCreate = false,
      cancelReview = false
    } = options
    const opts = {
      url: `${this.dcAddress}/extensions/${encodeURIComponent(extensionId)}/versions/${extensionVersion}/file`,
      headers: { authorization: `Bearer ${token}` },
      json: true,
      qs: {
        force: forceVersionCreate,
        cancelReview
      },
      formData: {
        extensionFile: fsEx.createReadStream(filePath)
      }
    }

    const response = await new Promise((resolve, reject) => {
      request.put(opts, (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })

    await this._handleDcResponse(response)

    return response.body
  }
}

module.exports = DcHttpClient
