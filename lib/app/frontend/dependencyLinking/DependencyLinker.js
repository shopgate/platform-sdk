/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { green, red, cyan, bold } = require('chalk')
const helpers = require('./helpers')
const LogHelper = require('../LogHelper')
const logger = require('../../../logger')
const PackageParser = require('./PackageParser')
const { PWA_FOLDER } = require('../FrontendSettings')

/**
 * The DependencyLinker class.
 * It enables easy package linking of checked out repositories to simplify development.
 */
class DependencyLinker {
  constructor () {
    this.logPrefix = LogHelper.getPrefix()
    this.packageParser = new PackageParser()
  }

  /**
   * Sets a list of package dependencies which can be used for linking.
   * @param {Array|string} [packages=[]] The packages.
   * @return {DependencyLinker}
   */
  setLinkableDependencies (packages = []) {
    this.packageParser.setLinkableDependencies(packages)
    return this
  }

  /**
   * Links dependencies into a passed list of packages.
   * @param {Array} [packages=[]] The packages.
   * @return {DependencyLinker}
   */
  link (packages = []) {
    logger.plain(`\n${this.logPrefix} Linking modules ...\n`)

    let tasks = [...packages]

    // Add the linkable dependencies to the tasks and remove tasks without dependencies.
    tasks = tasks.map((task) => ({
      ...task,
      dependencies: this.packageParser.parse(task.path).getLinkableDependencies()
    })).filter(({ dependencies }) => dependencies.length > 0)

    let dependencyPaths = []

    // Collect the paths of all linkable dependencies from the tasks.
    tasks.forEach(({ dependencies }) => {
      const paths = dependencies.map(({ path }) => path)

      dependencyPaths = dependencyPaths.concat(paths)
    })

    // Make the path entries unique.
    dependencyPaths = [...new Set(dependencyPaths)]

    if (dependencyPaths.length === 0) {
      // If there are no linkable packages, end this routine.
      logger.plain(`${red('✗')} ${bold('Nothing to link')}.\n`)
      logger.plain(`Make sure to check out the packages you may want to work on to the folder "${green(PWA_FOLDER)}"!\n`)
      logger.plain(`${this.logPrefix} Process finished.\n`)

      return this
    }

    logger.plain(`${bold(dependencyPaths.length)} linkable dependencies within ${bold(tasks.length)} packages found. Please wait ... \n`)

    // Link all linkable packages to the global modules.
    dependencyPaths.forEach((path) => {
      helpers.exec('npm link', path)
      const packageName = this.packageParser.parse(path).getName()
      logger.plain(`${green('✓')} ${bold(`Linked package ${cyan(packageName)} to the global modules`)}`)
    })

    // Link the global modules to the respective packages.
    tasks.forEach(({name: packageName, path: packagePath, dependencies}) => {
      logger.plain('')
      logger.plain(bold(`Linking dependencies to package ${green(packageName)}`))

      dependencies.forEach(({ name: dependencyName }) => {
        helpers.exec(`npm link ${dependencyName}`, packagePath, true)
        logger.plain(`${green('✓')} ${bold(`Linked global module ${cyan(dependencyName)} to ${cyan(packageName)}`)}`)
      })
    })

    logger.plain(`\n${this.logPrefix} Process finished.\n`)

    return this
  }
}

module.exports = DependencyLinker
