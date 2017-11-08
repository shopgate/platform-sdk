const request = require('request')

class DCHttpClient {
  constructor () {
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
      if (res.statusCode !== 200) return cb(new Error(body ? body.message : 'Login failed'))
      cb(null, body.accessToken)
    })
  }

  /*
    the following methods should send the JTW-Token inside the Authorization-Header
    If the response contains an "X-JWT" Header, the JWT-Token has to be updated!
 */
  /**
   * TODO: Update Token if necessary => userSession.setToken()
   * @param {Object} pipeline
   * @param {String} applicationId
   * @param {Session} userSession
   * @param {Function} cb
   */
  updatePipeline (pipeline, applicationId, userSession, cb) {
    const opts = {
      method: 'PUT',
      url: `${this.dcAddress}/applications/${applicationId}/pipelines/${pipeline.pipeline.id}`,
      json: true,
      body: pipeline,
      timeout: 2000,
      headers: {
        authorization: 'Bearer ' + userSession.getToken()
      }
    }

    console.log(opts.url)

    request(opts, (err, res, body) => {
      if (err) return cb(err)
      if (res.statusCode !== 204) return cb(new Error(body ? body.message : 'Pipeline update failed'))

      console.log('Header', res.header)

      // userSession.setToken()
      cb()
    })
  }
}

module.exports = DCHttpClient
