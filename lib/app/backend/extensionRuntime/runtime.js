process.on('message', message => {
  console.log(message)

  // const path = message.stepMeta.path
  // const id = message.stepMeta.id

  const action = function () {} // TODO: require from path, maybe with overriding require cache?!
  const context = {} // TODO: wait for context implementation, will use some vars from message.stepMeta.meta

  if (message.stepMeta.isErrorCatching) {
    return action(message.stepMeta.catchableError, message.input, context, (err, output) => {
      process.send({type: 'output', callId: message.stepMeta.callId, err, output})
    })
  }

  action(message.input, context, (err, output) => {
    process.send({type: 'output', callId: message.stepMeta.callId, err, output})
  })
})

process.on('SIGINT', () => process.exit(0))
