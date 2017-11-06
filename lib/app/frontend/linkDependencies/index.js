/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const DependencyLinker = require('./DependencyLinker')
const PackageCollector = require('./PackageCollector')
const { EXTENSIONS_FOLDER } = require('../../../app/AppSettings')
const { THEMES_FOLDER, PWA_FOLDER } = require('../../../app/frontend/FrontendSettings')

module.exports = (options) => {
  const packageCollector = new PackageCollector()
  const dependencyLinker = new DependencyLinker()

  // Determina all linkable dependencies and add them to the linker.
  dependencyLinker
    .setLinkableDependencies(packageCollector.get(PWA_FOLDER))

  let packages

  const { theme } = options

  if (theme) {
    // Link only the theme that was requested.
    packages = packageCollector
      .get(THEMES_FOLDER)
      .filter(({ name }) => name.endsWith(theme))
  } else {
    // Link everything that's possible if no option was set.
    packages = packageCollector
      .get([THEMES_FOLDER, EXTENSIONS_FOLDER, PWA_FOLDER])
  }

  dependencyLinker
    .link(packages)
}
