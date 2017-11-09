/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { readJsonSync } = require('fs-extra')

/**
 * The PackageParser class.
 * It provides methods to extract information form a package.json file.
 */
class PackageParser {
  constructor () {
    this.content = null
    this.linkableDependencies = []
  }

  /**
   * Initializes the package parser by parsing the package.json at the specified path.
   * @param {string} path The path of the package.
   * @return {PackageParser}
   */
  parse (path) {
    try {
      this.content = readJsonSync(`${path}/package.json`)
    } catch (e) {
      this.content = null
      throw new Error(`Invalid package at ${path}`)
    }

    return this
  }

  /**
   * Gets the name of the package.
   * @return {string}
   */
  getName () {
    if (this.content === null) {
      throw new Error('PackageParser not initialized')
    }

    return this.content.name
  }

  /**
   * Sets a list of packages for dependency linking.
   * @param {Array} [packages] The linkable packages.
   * @return {PackageParser}
   */
  setLinkableDependencies (packages) {
    this.linkableDependencies = packages
    return this
  }

  /**
   * Get all linkable depencencies from the package.json file.
   * @return {Object}
   */
  getLinkableDependencies () {
    /**
     * Filter linkable dependencies from a dependency source.
     * @param {Object} [source={}] The dependency source.
     * @return {Object}
     */
    const filterDependencies = (source = {}) => {
      const result = []

      // Loop through the package dependencies and filter those, which are available for linking.
      Object.keys(source).forEach((name) => {
        const dependency = this.linkableDependencies.find((dependency) => {
          return name === dependency.name
        })

        if (dependency) {
          result.push(dependency)
        }
      })

      return result
    }

    if (this.content === null) {
      throw new Error('PackageParser not initialized')
    }

    const { dependencies, devDependencies } = this.content

    // Get the linkable dependencies from the dependency sources of the package.json.
    return filterDependencies(dependencies).concat(filterDependencies(devDependencies))
  }
}

module.exports = PackageParser
