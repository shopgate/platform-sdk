/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { red } = require('chalk')
const { getSubDirectories, findSubDirectories } = require('./helpers')
const logger = require('../../../logger')
const PackageParser = require('./PackageParser')
const { EXTENSIONS_FOLDER } = require('../../../app/AppSettings')
const FRONTEND_EXTENSIONS_FOLDER = 'frontend'

/**
 * The PackageCollector class.
 */
class PackageCollector {
  /**
   * Searches for packages within a list of passed paths.
   * @param {Array|string} [paths] The paths where packages are located.
   * @return {Array} The available packages.
   */
  get (paths = []) {
    paths = typeof paths === 'string' ? [paths] : paths

    let packagePaths = []

    // Collect all directories which might contain packages.
    paths.forEach((path) => {
      let subDirs
      if (path.split('/').includes(EXTENSIONS_FOLDER)) {
        // Special treatment for the the "extensions" folder, since it's structure differs from other folders.
        subDirs = findSubDirectories(path, FRONTEND_EXTENSIONS_FOLDER)
      } else {
        subDirs = getSubDirectories(path)
      }

      packagePaths = packagePaths.concat(subDirs)
    })

    const packages = []

    // Collect package data from the directories.
    packagePaths.forEach((path) => {
      try {
        // Take care that only valid packages are added to the package list.
        packages.push({
          name: new PackageParser().parse(path).getName(),
          path
        })
      } catch (e) {
        // Don't break the processby throwing an error, but inform the user about the issue.
        logger.plain(`${red('Error')}: ${e.message}`)
      }
    })

    return packages
  }
}

module.exports = PackageCollector
