const assert = require('assert')
const getLocale = require('../../lib/utils/locale')

describe('locale', () => {
  it('should return a locale supported by Intl', () => {
    const locale = getLocale()

    assert.equal(typeof locale, 'string')
    assert.ok(locale)
    assert.doesNotThrow(() => new Intl.DateTimeFormat(locale))
  })
})
