class IntercomponentStorage {
  /**
   * @param {DCHttpClient} dCHttpClient
   * @param {string} appId
   */
  constructor (dCHttpClient, appId) {
    this.dCHttpClient = dCHttpClient
    this.appId = appId
  }

  /**
   * @param {string} infoType
   * @param {string} deviceId
   * @param {function} cb
   */
  getInfos (infoType, deviceId, cb) {
    if (!this[infoType]) this[infoType] = {}
    if (this[infoType][deviceId]) return cb(null, this[infoType][deviceId])
    this.dCHttpClient.getInfos(infoType, this.appId, deviceId, (err, data) => {
      if (err) return cb(err)
      this[infoType][deviceId] = data
      cb(null, data)
    })
  }
}

module.exports = IntercomponentStorage
