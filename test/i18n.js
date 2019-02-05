const assert = require('assert')
const fsEx = require('fs-extra')
const os = require('os')
const path = require('path')
const { promisify } = require('util')
const config = require('../lib/config')
const i18n = require('../lib/i18n')
const { I18n } = i18n

describe('Internationalization', () => {
  let tempDir

  before('Create temporary directory', async () => {
    tempDir = await promisify(fsEx.mkdtemp)(path.join(os.tmpdir(), 'sgtest-'))
    config.load({ localesDirectory: tempDir })
    await fsEx.writeJSON(path.join(tempDir, 'en.json'), {
      'some/file/path': {
        'key1': 'value1',
        'key2': 'value2 {VAR}'
      }
    })
    await fsEx.writeJSON(path.join(tempDir, 'de.json'), {
      'some/file/path': {
        'key1': 'Wert1',
        'key2': 'Wert2 {VAR}'
      }
    })
  })

  after('Delete temporary directory', async () => {
    await fsEx.remove(tempDir)
  })

  describe('I18n', () => {
    it('should instantiate', () => {
      const i18n = new I18n()
      assert(i18n instanceof I18n)
    })

    it('should get message by key', () => {
      const i18n = new I18n()
      const message = i18n.get(['some/file/path', 'key1'])
      assert.strictEqual(message, 'value1')
    })

    it('should load non-default locale', () => {
      const i18n = new I18n('de')
      const message = i18n.get(['some/file/path', 'key1'])
      assert.strictEqual(message, 'Wert1')
    })

    it('should return the keyPath if object was found by it', () => {
      const i18n = new I18n('de')
      const keyPath = ['some/file/path']
      const message = i18n.get(keyPath)
      assert.strictEqual(message, keyPath)
    })
  })

  describe('t()', () => {
    const modulePath = path.resolve(__dirname, '..', 'some', 'file', 'path.js')

    it('should get message by key namespaced by module', () => {
      const t = i18n(modulePath)

      const message1 = t('key1')
      assert.strictEqual(message1, 'value1')

      const message2 = t('key2', { VAR: 'variable' })
      assert.strictEqual(message2, 'value2 variable')
    })

    it('should support array keys', () => {
      const t = i18n(modulePath)

      const message1 = t(['key1'])
      assert.strictEqual(message1, 'value1')
    })

    it('should return the key itself if no message was found', () => {
      const t = i18n(modulePath)

      const message1 = t('key3')
      assert.strictEqual(message1, 'key3')
    })

    it('should throw if key is not neither string nor array', () => {
      const t = i18n(modulePath)
      const wrongKey = { 'key3': 'some' }
      const expectedError = new Error(`'${wrongKey}' is not a valid message key`)

      assert.throws(() => { t(wrongKey) }, expectedError)
    })
  })
})
