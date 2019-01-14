const path = require('path')
const fsEx = require('fs-extra')
const MessageFormat = require('messageformat')
const Messages = require('messageformat/messages')
const config = require('./config')

const rootDirectory = path.resolve(__dirname, '..')

class I18n {
  constructor (locale = 'en') {
    const locales = [locale]

    if (!locales.includes('en')) {
      locales.unshift('en')
    }

    const messageSet = {}
    locales.forEach((locale) => {
      const localeFilePath = path.resolve(config.get('localesDirectory'), `${locale}.json`)
      messageSet[locale] = fsEx.readJSONSync(localeFilePath)
    })

    const messageFormat = new MessageFormat(locales)
    this._messages = new Messages(messageFormat.compile(messageSet))
    this._messages.locale = locale
  }

  get (keyPath, data = {}) {
    if (this._messages.hasObject(keyPath)) {
      return keyPath
    }

    return this._messages.get(keyPath, data)
  }
}

let i18n

module.exports = (modulePath) => {
  if (!i18n) {
    i18n = new I18n('en')
  }

  const moduleNamespace = path.relative(rootDirectory, modulePath).replace(/\.js$/i, '')
  return (key, data) => {
    const keyPath = [moduleNamespace]

    if (Array.isArray(key)) {
      keyPath.push.apply(keyPath, key)
    } else if (typeof key === 'string') {
      keyPath.push(key)
    } else {
      throw new Error(`'${key}' is not a valid message key`)
    }

    const message = i18n.get(keyPath, data)

    if (message === keyPath) {
      return key
    }

    return message
  }
}

module.exports.I18n = I18n
