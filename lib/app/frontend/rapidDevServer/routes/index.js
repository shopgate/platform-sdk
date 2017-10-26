const request = require('request')
const RapidApi = require('../RapidApi')
const commandApi = require('../commandApi')

const RAPID_URL = 'https://sgxs-rapid2-dev.shopgate.services'
const APP_ID = process.env.appId

module.exports = (server) => {
  // Check the RAPID status.
  request.get(`${RAPID_URL}/status`, (err, res) => {
    if (err) throw err

    if (res.statusCode !== 200) {
      console.log(`\n  RAPID not available!`)
      return
    }

    console.log(`\n  RAPID available. Real data pipeline requests are possible ...`)

    // Create RAPID API.
    const rapidApi = new RapidApi({
      url: RAPID_URL,
      shopNumber: APP_ID,
      callback: () => {
        // Handle pipeline requests.
        server.post('/', rapidApi.handle)
      }
    })
  })

  /**
   * Open a special endpoint for WebStorage commands. These are
   * normally processed within the app and not sent to the backend.
   */
  server.post('/web_storage', commandApi)

  /**
   * Open a special endpoint for sendHttpRequest commands.
   */
  server.post('/http_request', commandApi)
}
