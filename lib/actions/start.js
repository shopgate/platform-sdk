function start () {
  throw new Error('start not possible')
}

module.exports = start
module.exports.cmd = commander => {
  commander
    .command('start')
    .description('start the sdk')
    .action(start)
}
