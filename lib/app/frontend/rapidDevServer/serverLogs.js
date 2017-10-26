const { cyan, green, blue } = require('chalk')

const DIVIDER = '---------------------------------------------------------------------------\n'

exports.logMode = () => {
  if (process.env.silent) {
    console.log('  SILENT MODE: logs will be suppressed.\n')
  }
}

exports.logo = () => {
  console.log(`\n${DIVIDER}`)
  console.log(`  ${green('S H O P G A T E')}   ${blue('C L O U D')}`)
  console.log('  D E V E L O P M E N T   S E R V E R\n')
  console.log(DIVIDER)
  exports.logMode()
}

exports.start = () => {
  console.log(`  Localhost: ${cyan(`http://localhost:${process.env.port}`)}`)
  console.log(`  LAN:       ${cyan(`http://${process.env.ip}:${process.env.port}`)}\n`)
  console.log(`  Press ${cyan.bold('CTRL-C')} to stop the server!\n`)
  console.log(DIVIDER)
}
