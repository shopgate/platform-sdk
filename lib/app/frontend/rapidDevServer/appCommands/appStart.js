const { ip, port } = require('../../../helpers/app').getDevConfig()

/**
 * The appStart command.
 * @param {Object} parameter Some command parameters.
 * @param {Function} callback The API callback.
 */
module.exports = (parameter, callback) => {
  const appStartResponseCommands = [
    {
      c: 'startMonitoringResources',
      p: {
        __dummy__: '__dummy__'
      }
    },
    {
      c: 'openPage',
      p: {
        targetTab: 'main',
        src: `http://${ip}:${port}/`,
        title: '',
        emulateBrowser: false
      }
    },
    {
      c: 'hideSplashScreen',
      p: {
        __dummy__: '__dummy__'
      }
    },
    {
      c: 'showTab',
      p: {
        targetTab: 'main'
      }
    }
  ]

  callback(null, appStartResponseCommands)
}
