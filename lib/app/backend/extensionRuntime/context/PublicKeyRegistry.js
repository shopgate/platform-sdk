const { constants, createPublicKey, publicEncrypt } = require('node:crypto')

/**
 * Local mirror of the pipeline controller's public key registry. The SDK encrypts payloads
 * locally with the configured RSA public keys so that plaintext never leaves the developer's
 * machine. Public keys are not secret and are fetched from the pipeline controller via HTTP.
 *
 * The crypto parameters (RSA-OAEP, SHA-256) and error messages are intentionally identical to the
 * pipeline controller so that the local development behaviour matches production exactly.
 */
class PublicKeyRegistry {
  /**
   * @param {Array<{alias: string, publicKeyPem: string}>} [keys]
   */
  constructor (keys = []) {
    this._keys = new Map()

    for (const { alias, publicKeyPem } of keys) {
      try {
        this._keys.set(alias, createPublicKey(publicKeyPem))
      } catch (err) {
        throw new Error(`invalid public key for alias "${alias}": ${err.message}`)
      }
    }

    Object.freeze(this)
  }

  encrypt (keyName, buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('context.encrypt expects a Buffer payload')
    }

    const key = this._keys.get(keyName)

    if (!key) {
      throw new Error(`unknown public key "${keyName}"`)
    }

    return publicEncrypt({
      key,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    }, buffer)
  }
}

module.exports = PublicKeyRegistry
