/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

module.exports = (defaultConfig) => ([
  {
    type: 'input',
    name: 'startpageIp',
    message: 'Which IP address should the app connect to?',
    default: defaultConfig.startpageIp
  },
  {
    type: 'input',
    name: 'port',
    message: 'On which port should the app run?',
    default: defaultConfig.port
  },
  {
    type: 'input',
    name: 'apiPort',
    message: 'On which port should the Rapid API run?',
    default: defaultConfig.apiPort
  },
  {
    type: 'input',
    name: 'hmrPort',
    message: 'On which port should the HMR (Hot Module Replacement) run?',
    default: defaultConfig.hmrPort
  },
  {
    type: 'input',
    name: 'remotePort',
    message: 'On which port should the remote dev server (redux) run?',
    default: defaultConfig.remotePort
  },
  {
    type: 'input',
    name: 'sourceMapsType',
    message: 'Please specify your development sourcemap type:',
    default: defaultConfig.sourceMapsType
  },
  {
    type: 'confirm',
    name: 'confirmed',
    message: 'Are these settings correct?',
    default: true
  }
])
