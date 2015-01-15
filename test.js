var tape = require('tape')
var memdb = require('memdb')
var changes = require('./')

tape('append and stream', function(t) {
  var feed = changes(memdb())

  feed.append('hello', function(err, node) {
    t.notOk(err, 'no err')
    t.same(node, {change:1, value:new Buffer('hello')})
    feed.createReadStream(function(err, changes) {
      t.notOk(err, 'no err')
      t.same(changes.length, 1, '1 change')
      t.same(changes[0], {change:1, value:new Buffer('hello')})
      t.end()
    })
  })
})

tape('append twice and stream', function(t) {
  var feed = changes(memdb())

  feed.append('hello', function() {
    feed.append('world', function() {
      feed.createReadStream(function(err, changes) {
        t.notOk(err, 'no err')
        t.same(changes.length, 2, '2 changes')
        t.same(changes[0], {change:1, value:new Buffer('hello')})
        t.same(changes[1], {change:2, value:new Buffer('world')})
        t.end()
      })
    })
  })
})

tape('append and live stream', function(t) {
  var feed = changes(memdb())

  feed.createReadStream({live:true})
    .on('data', function(data) {
      t.same(data, {change:1, value:new Buffer('hello')})
      t.end()
    })

  setImmediate(function() {
    feed.append('hello')
  })
})

tape('append close and reopen', function(t) {
  var db = memdb()
  var feed = changes(db)

  feed.append('hello', function() {
    var feed2 = changes(db)
    feed.append('world', function(err, node) {
      t.same(node, {change:2, value:new Buffer('world')})
      t.end()
    })
  })
})