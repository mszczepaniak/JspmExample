/* */ 
(function(process) {
  var ecstatic = require("../ecstatic"),
      fs = require("fs"),
      path = require("path"),
      he = require("he"),
      etag = require("./etag"),
      url = require("url"),
      status = require("./status-handlers");
  module.exports = function(opts, stat) {
    var cache = opts.cache,
        root = path.resolve(opts.root),
        baseDir = opts.baseDir,
        humanReadable = opts.humanReadable,
        handleError = opts.handleError,
        si = opts.si;
    return function middleware(req, res, next) {
      var parsed = url.parse(req.url),
          pathname = decodeURIComponent(parsed.pathname),
          dir = path.normalize(path.join(root, path.relative(path.join('/', baseDir), pathname)));
      fs.stat(dir, function(err, stat) {
        if (err) {
          return handleError ? status[500](res, next, {error: err}) : next();
        }
        fs.readdir(dir, function(err, files) {
          if (err) {
            return handleError ? status[500](res, next, {error: err}) : next();
          }
          res.setHeader('content-type', 'text/html');
          res.setHeader('etag', etag(stat));
          res.setHeader('last-modified', (new Date(stat.mtime)).toUTCString());
          res.setHeader('cache-control', cache);
          sortByIsDirectory(files, function(lolwuts, dirs, files) {
            if (path.resolve(dir, '..').slice(0, root.length) == root) {
              return fs.stat(path.join(dir, '..'), function(err, s) {
                if (err) {
                  return handleError ? status[500](res, next, {error: err}) : next();
                }
                dirs.unshift(['..', s]);
                render(dirs, files, lolwuts);
              });
            }
            render(dirs, files, lolwuts);
          });
          function sortByIsDirectory(paths, cb) {
            var pending = paths.length,
                errs = [],
                dirs = [],
                files = [];
            if (!pending) {
              return cb(errs, dirs, files);
            }
            paths.forEach(function(file) {
              fs.stat(path.join(dir, file), function(err, s) {
                if (err) {
                  errs.push([file, err]);
                } else if (s.isDirectory()) {
                  dirs.push([file, s]);
                } else {
                  files.push([file, s]);
                }
                if (--pending === 0) {
                  cb(errs, dirs, files);
                }
              });
            });
          }
          function render(dirs, files, lolwuts) {
            var html = ['<!doctype html>', '<html>', '  <head>', '    <meta charset="utf-8">', '    <meta name="viewport" content="width=device-width">', '    <title>Index of ' + pathname + '</title>', '  </head>', '  <body>', '<h1>Index of ' + pathname + '</h1>'].join('\n') + '\n';
            html += '<table>';
            var failed = false;
            var writeRow = function(file, i) {
              var isDir = file[1].isDirectory && file[1].isDirectory();
              var href = parsed.pathname.replace(/\/$/, '') + '/' + encodeURI(file[0]);
              if (isDir) {
                href += '/' + ((parsed.search) ? parsed.search : '');
              }
              var displayName = he.encode(file[0]) + ((isDir) ? '/' : '');
              html += '<tr>' + '<td><code>(' + permsToString(file[1]) + ')</code></td>' + '<td style="text-align: right; padding-left: 1em"><code>' + sizeToString(file[1], humanReadable, si) + '</code></td>' + '<td style="padding-left: 1em"><a href="' + href + '">' + displayName + '</a></td>' + '</tr>\n';
            };
            dirs.sort(function(a, b) {
              return a[0].toString().localeCompare(b[0].toString());
            }).forEach(writeRow);
            files.sort(function(a, b) {
              return a.toString().localeCompare(b.toString());
            }).forEach(writeRow);
            lolwuts.sort(function(a, b) {
              return a[0].toString().localeCompare(b[0].toString());
            }).forEach(writeRow);
            html += '</table>\n';
            html += '<br><address>Node.js ' + process.version + '/ <a href="https://github.com/jesusabdullah/node-ecstatic">ecstatic</a> ' + 'server running @ ' + he.encode(req.headers.host || '') + '</address>\n' + '</body></html>';
            ;
            if (!failed) {
              res.writeHead(200, {"Content-Type": "text/html"});
              res.end(html);
            }
          }
        });
      });
    };
  };
  function permsToString(stat) {
    if (!stat.isDirectory || !stat.mode) {
      return '???!!!???';
    }
    var dir = stat.isDirectory() ? 'd' : '-',
        mode = stat.mode.toString(8);
    return dir + mode.slice(-3).split('').map(function(n) {
      return ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'][parseInt(n, 10)];
    }).join('');
  }
  function sizeToString(stat, humanReadable, si) {
    if (stat.isDirectory && stat.isDirectory()) {
      return '';
    }
    var sizeString = '';
    var bytes = stat.size;
    var threshold = si ? 1000 : 1024;
    if (!humanReadable || bytes < threshold) {
      return bytes + 'B';
    }
    var units = ['k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    var u = -1;
    do {
      bytes /= threshold;
      ++u;
    } while (bytes >= threshold);
    var b = bytes.toFixed(1);
    if (isNaN(b))
      b = '??';
    return b + units[u];
  }
})(require("process"));
