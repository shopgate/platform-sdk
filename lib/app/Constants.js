const SETTINGS_FOLDER = '.sgcloud'
const EXTENSIONS_FOLDER = 'extensions'
const PIPELINES_FOLDER = 'pipelines'
const TRUSTED_PIPELINES_FOLDER = 'trustedPipelines'
const THEMES_FOLDER = 'themes'

// Why the extension runtime has no public encryption keys. Passed from the backend process to the
// runtime child via the ENCRYPTION_KEYS_UNAVAILABLE environment variable.
const UNAVAILABLE_UNSUPPORTED = 'unsupported'
const UNAVAILABLE_FAILED = 'failed'
const UNAVAILABLE_INVALID = 'invalid'

module.exports.SETTINGS_FOLDER = SETTINGS_FOLDER
module.exports.PIPELINES_FOLDER = PIPELINES_FOLDER
module.exports.TRUSTED_PIPELINES_FOLDER = TRUSTED_PIPELINES_FOLDER
module.exports.EXTENSIONS_FOLDER = EXTENSIONS_FOLDER
module.exports.THEMES_FOLDER = THEMES_FOLDER
module.exports.UNAVAILABLE_UNSUPPORTED = UNAVAILABLE_UNSUPPORTED
module.exports.UNAVAILABLE_FAILED = UNAVAILABLE_FAILED
module.exports.UNAVAILABLE_INVALID = UNAVAILABLE_INVALID
