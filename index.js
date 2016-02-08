var lexint = require('lexicographic-integer')
var collect = require('stream-collector')
var mutexify = require('mutexify')
var through = require('through2')
var from = require('from2')
var pump = require('pump')
var thunky = require('thunky')

var noop = function() {}

module.exports = function(db) {
  var feed = {}
  var lock = mutexify()

  var ensureCount = thunky(function(cb) {
    if (feed.change) return cb()
    collect(db.createKeyStream({reverse:true, limit:1}), function(err, keys) {
      if (err) return cb(err)
      if (!keys.length) return cb()
      feed.change = lexint.unpack(keys[0], 'hex')
      cb()
    })
  })

  feed.change = 0
  feed.notify = []

  feed.count = function(cb) {
    ensureCount(function (err) {
      if (err) return cb(err)
      cb(null, feed.change)
    });
  }

  feed.append = function(value, cb) {
    if (!cb) cb = noop
    if (!Buffer.isBuffer(value)) value = new Buffer(value)

    lock(function(release) {
      ensureCount(function(err) {
        if (err) return release(cb, err)
        db.put(lexint.pack(++feed.change, 'hex'), value, function(err) {
          var notify = feed.notify

          if (notify.length) {
            feed.notify = []
            for (var i = 0; i < notify.length; i++) notify[i][0](1, notify[i][1])
          }

          release(cb, err, {change:feed.change, value:value})
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
