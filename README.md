# changes-feed

Basic changes-feed implementation that runs on top of leveldb

```
npm install changes-feed
```

[![build status](http://img.shields.io/travis/mafintosh/changes-feed.svg?style=flat)](http://travis-ci.org/mafintosh/changes-feed)

## Usage

``` js
var changes = require('changes-feed')
var feed = changes(db) // db is a levelup

feed.createReadStream({live:true})
  .on('data', function(data) {
    console.log('someone appended:', data)
  })

feed.append('hello')
```

## API

#### `feed.append(value)`

Append a new value to the changes feed. The value should be a string or buffer

#### `stream = feed.createReadStream([options])`

Stream out entries from the log. Per default this will stream out all entries.
Options include:

``` js
{
  live: true,   // keep the stream open,
  since: number // only get changes >number
}
```

A stream data object looks like this

``` js
{
  change: number, // incrementing change number
  value: value    // the value appended
}
```

## License

MIT
