const convict = require('convict')
const dotenv = require('dotenv')
const schema = require('./schema')

dotenv.config()

const config = convict(schema)
config.validate({ allowed: 'strict' })

module.exports = config
