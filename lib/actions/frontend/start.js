const { fork } = require('child_process')
const { join } = require('path')

function start (cmd, options) {
  fork(join(__dirname, '../../app/frontend/rapidServer'), {
    env: {
      silent: !!options.silent
    }
  })
}

module.exports = start
module.exports.cmd = commander => {
  commander
    .command('frontend start')
    .description('start the frontend sdk')
    .action(start)
}
