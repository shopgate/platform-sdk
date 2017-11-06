/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { green, red, cyan, bold } = require('chalk')
const helpers = require('./helpers')
const LogHelper = require('../LogHelper')
const PackageParser = require('./PackageParser')
const { PWA_FOLDER } = require('../FrontendSettings')

/**
 * The DependencyLinker class.
 * It enables easy linking of Shopgate Cloud frontend repositories to support easy development.
 */
class DependencyLinker {
  constructor () {
    this.logHelper = new LogHelper()
    this.logPrefix = this.logHelper.getPrefix()

    this.packageParser = new PackageParser()
  }

  /**
   * Add a list of packages that are available for linking.
   * @param {Array} [packages=[]] The linkable packages.
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
    this.log(`\n${this.logPrefix} Linking modules ...\n`)

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
      this.log(`${red('✗')} ${bold('Nothing to link')}.\n`)
      this.log(`Make sure to check out the packages you may want to work on to the folder "${green(PWA_FOLDER)}"!\n`)
      this.log(`${this.logPrefix} Process finished.\n`)

      return this
    }

    this.log(`${bold(dependencyPaths.length)} linkable dependencies within ${bold(tasks.length)} packages found. Please wait ... \n`)

    // Link all linkable packages to the global modules.
    dependencyPaths.forEach((path) => {
      helpers.exec('npm link', path)
      const packageName = this.packageParser.parse(path).getName()
      this.log(`${green('✓')} ${bold(`Linked package ${cyan(packageName)} to the global modules`)}`)
    })

    // Link the global modules to the respective packages.
    tasks.forEach(({name: packageName, path: packagePath, dependencies}) => {
      this.log('')
      this.log(bold(`Linking dependencies to package ${green(packageName)}`))

      dependencies.forEach(({ name: dependencyName }) => {
        helpers.exec(`npm link ${dependencyName}`, packagePath, true)
        this.log(`${green('✓')} ${bold(`Linked global module ${cyan(dependencyName)} to ${cyan(packageName)}`)}`)
      })
    })

    this.log(`\n${this.logPrefix} Process finished.\n`)

    return this
  }

  /**
   * Logs a message
   * @param {string} message The message
   * @return {DependencyLinker}
   */
  log (message) {
    this.logHelper.log(message)
    return this
  }
}

module.exports = DependencyLinker
