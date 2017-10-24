const request = require('request')

class DCHttpClient {
  constructor () {
    this.dcAddress = process.env.SGCLOUD_DC_ADDRESS || 'https://developers.sgcloud.something'
  }

  login (username, password, cb) {
    const opts = {
      method: 'POST',
      url: `${this.dcAddress}/login`,
      json: true,
      body: {username, password}
    }

    request(opts, (err, res, body) => {
      if (err) return cb(err)
      if (res.statusCode !== 200) return cb(new Error(body ? body.message : 'Login failed'))
      cb(null, body.accessToken)
    })
  }

  /*
    schickt JWT-Token mit an DC (Authorization: Bearer $JWT)
    wenn response den header "X-JWT" enthält => update token in session
 */
}

module.exports = DCHttpClient