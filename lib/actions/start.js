function start () {
  throw new Error('start not possible')
}

module.exports = start
module.exports.cmd = function (commander) {
  commander
    .command('start')
    .description('start the sdk')
    .action(start)
}
