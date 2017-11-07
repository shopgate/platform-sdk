/**
 * Copyright (c) 2017, Shopgate, Inc. All rights reserved.
 *
 * This source code is licensed under the Apache 2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { green, red, cyan, bold } = require('chalk')
const { execSync } = require('child_process')
const LogHelper = require('../LogHelper')
const logger = require('../../../logger')
const PackageParser = require('./PackageParser')
const PackageCollector = require('./PackageCollector')
const { EXTENSIONS_FOLDER } = require('../../../app/AppSettings')
const { THEMES_FOLDER, PWA_FOLDER } = require('../../../app/frontend/FrontendSettings')

/**
 * The DependencyLinker class.
 * It enables easy package linking of checked out repositories to simplify development.
 */
class DependencyLinker {
  constructor (options = {}) {
    this.options = options
    this.logPrefix = LogHelper.getPrefix()
    this.packages = []
    this.linkableDependencies = []
  }

  init () {
    const packageCollector = new PackageCollector()
    const { theme } = this.options
    let packages

    if (theme) {
      // Link only the theme that was requested.
      packages = packageCollector
        .get(THEMES_FOLDER)
        .filter(({ name }) => name.endsWith(`theme-${theme}`))
    } else {
      // Link everything that's possible if no option was set.
      packages = packageCollector
        .get([THEMES_FOLDER, EXTENSIONS_FOLDER, PWA_FOLDER])
    }

    this.packages = packages
    this.linkableDependencies = packageCollector.get(PWA_FOLDER)

    return this
  }

  /**
   * Links the package dependencies.
   * @return {DependencyLinker}
   */
  link () {
    logger.plain(`\n${this.logPrefix} Linking modules ...\n`)

    let tasks = [...this.packages]

    // Add the linkable dependencies to the tasks and remove tasks without dependencies.
    tasks = tasks.map((task) => {
      const packageParser = new PackageParser()
      const dependencies = packageParser
        .parse(task.path)
        .setLinkableDependencies(this.linkableDependencies)
        .getLinkableDependencies()

      return {
        ...task,
        dependencies
      }
    }).filter(({ dependencies }) => dependencies.length > 0)

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
      this.exec('npm link', path)
      const packageParser = new PackageParser()
      const packageName = packageParser.parse(path).getName()
      logger.plain(`${green('✓')} ${bold(`Linked package ${cyan(packageName)} to the global modules`)}`)
    })

    // Link the global modules to the respective packages.
    tasks.forEach(({name: packageName, path: packagePath, dependencies}) => {
      logger.plain('')
      logger.plain(bold(`Linking dependencies to package ${green(packageName)}`))

      dependencies.forEach(({ name: dependencyName }) => {
        this.exec(`npm link ${dependencyName}`, packagePath, true)
        logger.plain(`${green('✓')} ${bold(`Linked global module ${cyan(dependencyName)} to ${cyan(packageName)}`)}`)
      })
    })

    logger.plain(`\n${this.logPrefix} Process finished.\n`)

    return tasks
  }

  /**
   * Execute a command sycronously.
   * @param {string} command The command to execute.
   * @param {string} [cwd] The working directory.
   * @param {boolean} [silent=false] Tells of the stdout shall be suppressed.
   * @return {Buffer|string} The stdout from the command.
   */
  exec (cmd, cwd, silent = false) {
    return execSync(cmd, {
      ...cwd && { cwd },
      stdio: silent ? '' : 'inherit'
    })
  }
}

module.exports = DependencyLinker
