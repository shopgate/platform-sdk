const PublicKeyRegistry = require('./PublicKeyRegistry')
const { UNAVAILABLE_UNSUPPORTED, UNAVAILABLE_FAILED, UNAVAILABLE_INVALID } = require('../../../Constants')
const t = require('../../../../i18n')(__filename)

/**
 * Turns the reason code passed by the backend process into the message a step sees when it calls
 * `context.encrypt` without any keys being available. Without it the call would fail with a plain
 * "unknown public key", which points at the alias instead of at the actual cause.
 *
 * @param {string} [reasonCode]
 * @returns {string|null}
 */
function encryptUnavailableMessage (reasonCode) {
  switch (reasonCode) {
    case UNAVAILABLE_UNSUPPORTED: return t('ENCRYPTION_UNAVAILABLE_UNSUPPORTED')
    case UNAVAILABLE_FAILED: return t('ENCRYPTION_UNAVAILABLE_FAILED')
    case UNAVAILABLE_INVALID: return t('ENCRYPTION_UNAVAILABLE_INVALID')
    default: return null
  }
}

/**
 * Builds the key registry of a runtime child from the environment it was forked with. The backend
 * process loads the keys once at startup and passes them through `ENCRYPTION_PUBLIC_KEYS` plus
 * `ENCRYPTION_KEYS_UNAVAILABLE`; see BackendAction#loadEncryptionKeys.
 *
 * Never throws: unparsable or malformed key material degrades to an empty registry that explains
 * itself when a step calls `context.encrypt`.
 *
 * @param {Object} env
 * @param {string} [env.ENCRYPTION_PUBLIC_KEYS] JSON encoded array of `{ alias, publicKeyPem }`
 * @param {string} [env.ENCRYPTION_KEYS_UNAVAILABLE] one of the UNAVAILABLE_* reason codes
 * @param {Logger} logger
 * @returns {PublicKeyRegistry}
 */
function publicKeyRegistryFromEnv (env, logger) {
  try {
    return new PublicKeyRegistry(
      JSON.parse(env.ENCRYPTION_PUBLIC_KEYS || '[]'),
      encryptUnavailableMessage(env.ENCRYPTION_KEYS_UNAVAILABLE)
    )
  } catch (err) {
    logger.warn(t('ERROR_INVALID_ENCRYPTION_KEYS'))
    logger.debug({ err }, t('ERROR_INVALID_ENCRYPTION_KEYS'))
    return new PublicKeyRegistry([], encryptUnavailableMessage(UNAVAILABLE_INVALID))
  }
}

module.exports = publicKeyRegistryFromEnv
module.exports.encryptUnavailableMessage = encryptUnavailableMessage
