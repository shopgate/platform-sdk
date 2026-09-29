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
   * @param {string|null} [unavailableReason] why no keys could be loaded, reported instead of
   *   "unknown public key" when the registry is empty because of a failed lookup
   */
  constructor (keys = [], unavailableReason = null) {
    this._keys = new Map()
    this._unavailableReason = unavailableReason

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
      // An empty registry plus a known reason means the keys never arrived — reporting the alias as
      // unknown would send the developer looking for a typo that isn't there.
      if (this._keys.size === 0 && this._unavailableReason) {
        throw new Error(this._unavailableReason)
      }

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
