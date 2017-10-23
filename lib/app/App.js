const path = require('path')
const fs = require('fs')

let instance

class App {
  /**
   * @returns {App}
   */
  static getInstance () {
    if (!instance) instance = new App()
    return instance
  }

  constructor () {
    this.settingsFolder = '.sgcloud'
    this.settingsFile = path.join(this.settingsFolder, 'settings')

    this.init()
  }

  /**
   * @returns {string}
   */
  getId () {
    return this.id
  }

  /**
   * @param {string} id
   * @returns {App}
   */
  setId (id) {
    this.id = id
    return this
  }

  /**
   * @returns {App}
   */
  init () {
    if (!fs.existsSync(this.settingsFolder)) fs.mkdirSync(this.settingsFolder)
    if (fs.existsSync(this.settingsFile)) {
      const data = JSON.parse(fs.readFileSync(this.settingsFile))
      this.id = data.id
    }
    return this
  }

  /**
   * @returns {App}
   */
  save () {
    fs.writeFileSync(this.settingsFile, JSON.stringify(this))
    return this
  }

  /**
   * @returns {object}
   */
  toJSON () {
    return {
      id: this.id
    }
  }
}

module.exports = App
