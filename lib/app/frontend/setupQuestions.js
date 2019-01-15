/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */
const t = require('../../i18n')(__filename)

module.exports = (defaultConfig) => ([
  {
    type: 'input',
    name: 'ip',
    message: t('IP'),
    default: defaultConfig.ip
  },
  {
    type: 'input',
    name: 'port',
    message: t('PORT'),
    default: defaultConfig.port
  },
  {
    type: 'input',
    name: 'apiPort',
    message: t('API_PORT'),
    default: defaultConfig.apiPort
  },
  {
    type: 'input',
    name: 'hmrPort',
    message: t('HMR_PORT'),
    default: defaultConfig.hmrPort
  },
  {
    type: 'input',
    name: 'remotePort',
    message: t('REMOTE_PORT'),
    default: defaultConfig.remotePort
  },
  {
    type: 'input',
    name: 'sourceMapsType',
    message: t('SOURCE_MAP_TYPE'),
    default: defaultConfig.sourceMapsType
  },
  {
    type: 'confirm',
    name: 'confirmed',
    message: t('CONFIRM'),
    default: true
  }
])
