const convict = require('convict')
const dotenv = require('dotenv')
const schema = require('./schema')

dotenv.config({ quiet: true })

const config = convict(schema)
config.validate({ allowed: 'strict' })

module.exports = config
