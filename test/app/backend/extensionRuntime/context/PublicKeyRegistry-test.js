const assert = require('assert')
const { constants, generateKeyPairSync, privateDecrypt } = require('node:crypto')

const PublicKeyRegistry = require('../../../../../lib/app/backend/extensionRuntime/context/PublicKeyRegistry')

describe('PublicKeyRegistry (SDK)', () => {
  let publicKeyPem
  let privateKey

  beforeEach(() => {
    const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 })
    publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    privateKey = keyPair.privateKey
  })

  it('encrypts a buffer that the matching private key can decrypt', () => {
    const registry = new PublicKeyRegistry([{ alias: 'PARTNER_A', publicKeyPem }])

    const encrypted = registry.encrypt('PARTNER_A', Buffer.from('secret'))
    const decrypted = privateDecrypt({
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    }, encrypted)

    assert.strictEqual(decrypted.toString(), 'secret')
  })

  it('throws on an unknown alias', () => {
    const registry = new PublicKeyRegistry([{ alias: 'PARTNER_A', publicKeyPem }])
    assert.throws(() => registry.encrypt('UNKNOWN', Buffer.from('secret')), /unknown public key "UNKNOWN"/)
  })

  it('rejects non-buffer payloads', () => {
    const registry = new PublicKeyRegistry([{ alias: 'PARTNER_A', publicKeyPem }])
    assert.throws(() => registry.encrypt('PARTNER_A', 'secret'), /context\.encrypt expects a Buffer payload/)
  })

  it('throws on an invalid PEM', () => {
    assert.throws(() => new PublicKeyRegistry([{ alias: 'PARTNER_A', publicKeyPem: 'not a pem' }]), /invalid public key for alias "PARTNER_A"/)
  })

  it('builds an empty registry by default', () => {
    assert.throws(() => new PublicKeyRegistry().encrypt('PARTNER_A', Buffer.from('x')), /unknown public key "PARTNER_A"/)
  })
})
