const fs = require('node:fs')
const path = require('node:path')
const convict = require('convict')
const schema = require('./schema')

const envFile = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envFile)) process.loadEnvFile(envFile)

const config = convict(schema)
config.validate({ allowed: 'strict' })

module.exports = config
