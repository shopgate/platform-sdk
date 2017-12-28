function (context, input, cb) {
  cb(null, input.foo.bar.notThere)
}