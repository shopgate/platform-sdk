/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
        src: `http://${process.env.ip}:${process.env.port}/`,
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
