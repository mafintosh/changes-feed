var db = require('level')('db')
var feed = require('./')(db)

feed.createReadStream({since:2, live:true})
  .on('data', console.log)

setTimeout(function() {
  feed.append('world')
}, 400)