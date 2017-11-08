/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')
const WebpackConfigurator = require('../webpackConfig/WebpackConfigurator')
const themes = require('../Themes')

const configurator = new WebpackConfigurator(themes.getConfig())
const webpackConfig = configurator.getConfig()
const serverConfig = configurator.getServerConfig()

const compiler = webpack(webpackConfig)
const server = new WebpackDevServer(compiler, serverConfig)

server.listen(serverConfig.port, serverConfig.host)
