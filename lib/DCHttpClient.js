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
   * @param {String} applicationId
   * @param {Session} userSession
   * @param {Function} cb
   */
  getPipelines (applicationId, userSession, cb) {
    const opts = {
      method: 'GET',
      url: `${this.dcAddress}/applications/${applicationId}/pipelines`,
      timeout: 10000,
      json: true,
      headers: {
        authorization: 'Bearer ' + userSession.token
      }
    }

    request(opts, (err, res, body) => {
      if (err) return cb(err)
      if (res.statusCode !== 200) return cb(new Error(body ? body.message : 'Could not retrieve pipelines'))

      if (res.headers['x-jwt']) {
        userSession.setToken(res.headers['x-jwt'])
      }

      cb(null, body.pipelines)
    })
  }
}

module.exports = DCHttpClient
