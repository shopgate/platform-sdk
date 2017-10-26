const webStorageEntries = {
  clientInformation: {
    device: {
      advertisingId: 'f565d871-64f7-4e93-89a1-d343b80a5e08',
      cameras: [{
        light: true,
        resolutionX: 4160,
        resolutionY: 3120,
        type: 'back',
        video: true
      }, {
        light: false,
        resolutionX: 2560,
        resolutionY: 1920,
        type: 'front',
        video: true
      }],
      carrier: '',
      locale: 'de',
      model: 'Redmi Note 4',
      os: {
        apiLevel: '23',
        platform: 'android',
        ver: '6.0'
      },
      screen: {
        height: 1920,
        scale: 3,
        width: 1080
      },
      type: 'phone'
    },
    appVersion: '5.18.0',
    codebaseVersion: '5.18.0',
    libVersion: '2.0',
    hasInAppBrowserSupport: true,
    deviceId: 'sgxs-did-220a2cbd-aaaa-40c2-88b1-4d28593c1e80'
  }
}

/**
 * Getter for WebStorageEntries
 * @param {Object} name Name of the WebStorageEntry
 * @param {Function} cb Callback
 */
const get = function (name, cb) {
  let age = null
  const value = webStorageEntries[name] || null

  if (value) {
    // TODO dynamize if the WebStorage gets more relevant
    age = '340'
  }

  cb(null, age, value)
}

// TODO implement a setter, if the WebStorage gets more relevant
module.exports = {
  get
}
