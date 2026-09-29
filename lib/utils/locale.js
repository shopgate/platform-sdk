function getLocale () {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'
  } catch (err) {
    return 'en-US'
  }
}

module.exports = getLocale
