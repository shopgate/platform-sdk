const { STATUS_CODES } = require('http')

const createErrorClass = (statusCode) => class extends Error {
  constructor (body = {}) {
    let message
    let data

    if (typeof body === 'string') {
      message = body
      data = {}
    } else {
      ({ message, ...data } = body)
    }
    super(message || STATUS_CODES[statusCode] || 'Unknown error')
    this.data = data
  }
}

exports.UnauthorizedError = createErrorClass(401)
exports.NotFoundError = createErrorClass(404)
exports.ConflictError = createErrorClass(409)
exports.SoftError = createErrorClass()
