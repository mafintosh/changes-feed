var lexint = require('lexicographic-integer')
var collect = require('stream-collector')
var through = require('through2')
var from = require('from2')
var pump = require('pump')

var noop = function() {}

module.exports = function(db) {
  var feed = {}
  var ensureCount = function(cb) {
    if (feed.change) return cb()
    collect(db.createKeyStream({reverse:true, limit:1}), function(err, keys) {
      if (err) return cb(err)
      if (!keys.length) return cb()
      feed.change = lexint.unpack(keys[0], 'hex')
      cb()
    })
  }

  feed.change = 0
  feed.notify = []
  feed.batch = []

  feed.append = function(value, cb) {
    if (!cb) cb = noop
    if (!Buffer.isBuffer(value)) value = new Buffer(value)

    ensureCount(function(err) {
      if (err) return release(cb, err)

      var batch = feed.batch
      var change = ++feed.change
      batch.push({
        change: change,
        key: lexint.pack(change, 'hex'),
        value: value,
        callback: cb
      })

      if (batch.length !== 1) return

      // schedule batch commit
      process.nextTick(function () {
        batch = batch.slice()
        feed.batch.length = 0

        db.batch(batch.map(function (item) {
          return {
            type: 'put',
            key: item.key,
            value: item.value
          }
        }), function(err) {
          var notify = feed.notify

          if (notify.length) {
            feed.notify = []
            for (var i = 0; i < notify.length; i++) notify[i][0](1, notify[i][1])
          }

          batch.forEach(function (item, i) {
            item.callback(err, { change: batch[i].change, value: value })
          })
        })
      })
    })
  }

  feed.createReadStream = function(opts, cb) {
    if (typeof opts === 'function') return feed.createReadStream(null, opts)
    if (!opts) opts = {}

    var since = opts.since || 0

    if (opts.live) {
      return from.obj(function read(size, cb) {
        db.get(lexint.pack(since+1, 'hex'), {valueEncoding:'binary'}, function(err, value) {
          if (err && err.notFound) return feed.notify.push([read, cb])
          if (err) return cb(err)
          cb(null, {change:++since, value:value})
        })
      })
    }

    var rs = db.createReadStream({
      gt: lexint.pack(since, 'hex'),
      limit: opts.limit,
      reverse: opts.reverse,
      valueEncoding: 'binary'
    })

    var format = function(data, enc, cb) {
      cb(null, {change:lexint.unpack(data.key, 'hex'), value:data.value})
    }

    return collect(pump(rs, through.obj(format)), cb)
  }

  return feed
}
