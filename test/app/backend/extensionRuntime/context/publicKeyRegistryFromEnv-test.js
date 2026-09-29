const assert = require('assert')
const { generateKeyPairSync } = require('node:crypto')

const publicKeyRegistryFromEnv = require('../../../../../lib/app/backend/extensionRuntime/context/publicKeyRegistryFromEnv')
const { UNAVAILABLE_UNSUPPORTED, UNAVAILABLE_FAILED, UNAVAILABLE_INVALID } = require('../../../../../lib/app/Constants')

describe('publicKeyRegistryFromEnv', () => {
  let publicKeyPem
  let logger
  let warnings

  beforeEach(() => {
    publicKeyPem = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .publicKey.export({ type: 'spki', format: 'pem' }).toString()

    warnings = []
    logger = { warn: (message) => warnings.push(message), debug: () => {} }
  })

  it('builds a usable registry from the forked environment', () => {
    const env = { ENCRYPTION_PUBLIC_KEYS: JSON.stringify([{ alias: 'PARTNER_A', publicKeyPem }]) }

    const registry = publicKeyRegistryFromEnv(env, logger)

    assert.ok(Buffer.isBuffer(registry.encrypt('PARTNER_A', Buffer.from('secret'))))
    assert.deepEqual(warnings, [])
  })

  it('builds an empty registry when the backend passed no keys at all', () => {
    const registry = publicKeyRegistryFromEnv({}, logger)

    assert.throws(() => registry.encrypt('PARTNER_A', Buffer.from('x')), /unknown public key "PARTNER_A"/)
    assert.deepEqual(warnings, [])
  })

  describe('unavailable reasons', () => {
    it('explains an outdated pipeline controller', () => {
      const registry = publicKeyRegistryFromEnv({ ENCRYPTION_KEYS_UNAVAILABLE: UNAVAILABLE_UNSUPPORTED }, logger)

      assert.throws(() => registry.encrypt('PARTNER_A', Buffer.from('x')), /is probably outdated/)
    })

    it('explains a failed key lookup', () => {
      const registry = publicKeyRegistryFromEnv({ ENCRYPTION_KEYS_UNAVAILABLE: UNAVAILABLE_FAILED }, logger)

      assert.throws(() => registry.encrypt('PARTNER_A', Buffer.from('x')), /could not be loaded when the backend process was started/)
    })

    it('explains invalid key material', () => {
      const registry = publicKeyRegistryFromEnv({ ENCRYPTION_KEYS_UNAVAILABLE: UNAVAILABLE_INVALID }, logger)

      assert.throws(() => registry.encrypt('PARTNER_A', Buffer.from('x')), /were invalid/)
    })

    it('falls back to the plain unknown-key error on an unknown reason code', () => {
      const registry = publicKeyRegistryFromEnv({ ENCRYPTION_KEYS_UNAVAILABLE: 'something else' }, logger)

      assert.throws(() => registry.encrypt('PARTNER_A', Buffer.from('x')), /unknown public key "PARTNER_A"/)
    })

    it('prefers an alias hit over the reason', () => {
      const env = {
        ENCRYPTION_PUBLIC_KEYS: JSON.stringify([{ alias: 'PARTNER_A', publicKeyPem }]),
        ENCRYPTION_KEYS_UNAVAILABLE: UNAVAILABLE_FAILED
      }

      const registry = publicKeyRegistryFromEnv(env, logger)

      assert.ok(Buffer.isBuffer(registry.encrypt('PARTNER_A', Buffer.from('secret'))))
    })
  })

  describe('degradation', () => {
    it('degrades to an explaining registry when the env holds no valid JSON', () => {
      const registry = publicKeyRegistryFromEnv({ ENCRYPTION_PUBLIC_KEYS: 'not json' }, logger)

      assert.throws(() => registry.encrypt('PARTNER_A', Buffer.from('x')), /were invalid/)
      assert.ok(warnings.some(warning => /Received invalid encryption keys/.test(warning)))
    })

    it('degrades to an explaining registry when a public key is not a valid PEM', () => {
      const env = { ENCRYPTION_PUBLIC_KEYS: JSON.stringify([{ alias: 'PARTNER_A', publicKeyPem: 'not a pem' }]) }

      const registry = publicKeyRegistryFromEnv(env, logger)

      assert.throws(() => registry.encrypt('PARTNER_A', Buffer.from('x')), /were invalid/)
      assert.ok(warnings.some(warning => /Received invalid encryption keys/.test(warning)))
    })

    it('reports the invalid reason over a reason the backend had sent', () => {
      const env = {
        ENCRYPTION_PUBLIC_KEYS: 'not json',
        ENCRYPTION_KEYS_UNAVAILABLE: UNAVAILABLE_UNSUPPORTED
      }

      const registry = publicKeyRegistryFromEnv(env, logger)

      assert.throws(() => registry.encrypt('PARTNER_A', Buffer.from('x')), /were invalid/)
    })
  })

  describe('encryptUnavailableMessage', () => {
    const { encryptUnavailableMessage } = publicKeyRegistryFromEnv

    it('returns null for an absent reason code', () => {
      assert.strictEqual(encryptUnavailableMessage(undefined), null)
    })

    it('returns null for the empty reason the backend sends on success', () => {
      assert.strictEqual(encryptUnavailableMessage(''), null)
    })

    it('returns a message for every known reason code', () => {
      [UNAVAILABLE_UNSUPPORTED, UNAVAILABLE_FAILED, UNAVAILABLE_INVALID].forEach(reasonCode => {
        assert.ok(/^context\.encrypt is unavailable: /.test(encryptUnavailableMessage(reasonCode)), reasonCode)
      })
    })
  })
})
