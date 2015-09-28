/* */ 
(function(process) {
  var path = require("path"),
      fs = require("fs"),
      url = require("url"),
      mime = require("mime"),
      urlJoin = require("url-join"),
      showDir = require("./ecstatic/showdir"),
      version = JSON.parse(fs.readFileSync(__dirname + '/../package.json').toString()).version,
      status = require("./ecstatic/status-handlers"),
      etag = require("./ecstatic/etag"),
      optsParser = require("./ecstatic/opts");
  var ecstatic = module.exports = function(dir, options) {
    if (typeof dir !== 'string') {
      options = dir;
      dir = options.root;
    }
    var root = path.join(path.resolve(dir), '/'),
        opts = optsParser(options),
        cache = opts.cache,
        autoIndex = opts.autoIndex,
        baseDir = opts.baseDir,
        defaultExt = opts.defaultExt,
        handleError = opts.handleError,
        serverHeader = opts.serverHeader;
    opts.root = dir;
    if (defaultExt && /^\./.test(defaultExt))
      defaultExt = defaultExt.replace(/^\./, '');
    return function middleware(req, res, next) {
      while (req.url.indexOf('%00') !== -1) {
        req.url = req.url.replace(/\%00/g, '');
      }
      var parsed = url.parse(req.url);
      try {
        decodeURIComponent(req.url);
        var pathname = decodePathname(parsed.pathname);
      } catch (err) {
        return status[400](res, next, {error: err});
      }
      var file = path.normalize(path.join(root, path.relative(path.join('/', baseDir), pathname))),
          gzipped = file + '.gz';
      if (serverHeader !== false) {
        res.setHeader('server', 'ecstatic-' + version);
      }
      if (file.slice(0, root.length) !== root) {
        return status[403](res, next);
      }
      if (req.method && (req.method !== 'GET' && req.method !== 'HEAD')) {
        return status[405](res, next);
      }
      function statFile() {
        fs.stat(file, function(err, stat) {
          if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
            if (req.statusCode == 404) {
              status[404](res, next);
            } else if (!path.extname(parsed.pathname).length && defaultExt) {
              middleware({url: parsed.pathname + '.' + defaultExt + ((parsed.search) ? parsed.search : '')}, res, next);
            } else {
              middleware({
                url: (handleError ? ('/' + path.join(baseDir, '404.' + defaultExt)) : req.url),
                statusCode: 404
              }, res, next);
            }
          } else if (err) {
            status[500](res, next, {error: err});
          } else if (stat.isDirectory()) {
            if (!parsed.pathname.match(/\/$/)) {
              res.statusCode = 302;
              res.setHeader('location', parsed.pathname + '/' + (parsed.query ? ('?' + parsed.query) : ''));
              return res.end();
            }
            if (autoIndex) {
              return middleware({url: urlJoin(encodeURIComponent(pathname), '/index.' + defaultExt)}, res, function(err) {
                if (err) {
                  return status[500](res, next, {error: err});
                }
                if (opts.showDir) {
                  return showDir(opts, stat)(req, res);
                }
                return status[403](res, next);
              });
            }
            if (opts.showDir) {
              return showDir(opts, stat)(req, res);
            }
            status[404](res, next);
          } else {
            serve(stat);
          }
        });
      }
      if (opts.gzip && shouldCompress(req)) {
        fs.stat(gzipped, function(err, stat) {
          if (!err && stat.isFile()) {
            file = gzipped;
            return serve(stat);
          } else {
            statFile();
          }
        });
      } else {
        statFile();
      }
      function serve(stat) {
        var defaultType = opts.contentType || 'application/octet-stream',
            contentType = mime.lookup(file, defaultType),
            charSet;
        if (contentType) {
          charSet = mime.charsets.lookup(contentType, 'utf-8');
          if (charSet) {
            contentType += '; charset=' + charSet;
          }
        }
        if (path.extname(file) === '.gz') {
          res.setHeader('Content-Encoding', 'gzip');
          contentType = mime.lookup(path.basename(file, ".gz"), defaultType);
        }
        var range = (req.headers && req.headers['range']);
        if (range) {
          var total = stat.size;
          var parts = range.replace(/bytes=/, "").split("-");
          var partialstart = parts[0];
          var partialend = parts[1];
          var start = parseInt(partialstart, 10);
          var end = Math.min(total - 1, partialend ? parseInt(partialend, 10) : total - 1);
          var chunksize = (end - start) + 1;
          if (start > end || isNaN(start) || isNaN(end)) {
            return status['416'](res, next);
          }
          var fstream = fs.createReadStream(file, {
            start: start,
            end: end
          });
          fstream.on('error', function(err) {
            status['500'](res, next, {error: err});
          });
          res.on('close', function() {
            fstream.destroy();
          });
          res.writeHead(206, {
            'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType
          });
          fstream.pipe(res);
          return;
        }
        res.setHeader('etag', etag(stat));
        res.setHeader('last-modified', (new Date(stat.mtime)).toUTCString());
        res.setHeader('cache-control', cache);
        if (req.headers && ((req.headers['if-none-match'] === etag(stat)) || (new Date(Date.parse(req.headers['if-modified-since'])) >= stat.mtime))) {
          return status[304](res, next);
        }
        res.setHeader('content-length', stat.size);
        res.setHeader('content-type', contentType);
        res.statusCode = req.statusCode || 200;
        if (req.method === "HEAD") {
          return res.end();
        }
        var stream = fs.createReadStream(file);
        stream.pipe(res);
        stream.on('error', function(err) {
          status['500'](res, next, {error: err});
        });
      }
    };
  };
  ecstatic.version = version;
  ecstatic.showDir = showDir;
  function shouldCompress(req) {
    var headers = req.headers;
    return headers && headers['accept-encoding'] && headers['accept-encoding'].split(",").some(function(el) {
      return ['*', 'compress', 'gzip', 'deflate'].indexOf(el) != -1;
    });
    ;
  }
  function decodePathname(pathname) {
    var pieces = pathname.replace(/\\/g, "/").split('/');
    return pieces.map(function(piece) {
      piece = decodeURIComponent(piece);
      if (process.platform === 'win32' && /\\/.test(piece)) {
        throw new Error('Invalid forward slash character');
      }
      return piece;
    }).join('/');
  }
  if (!module.parent) {
    var http = require("http"),
        opts = require("minimist")(process.argv.slice(2)),
        port = opts.port || opts.p || 8000,
        dir = opts.root || opts._[0] || process.cwd();
    if (opts.help || opts.h) {
      var u = console.error;
      u('usage: ecstatic [dir] {options} --port PORT');
      u('see https://npm.im/ecstatic for more docs');
      return;
    }
    http.createServer(ecstatic(dir, opts)).listen(port, function() {
      console.log('ecstatic serving ' + dir + ' at http://0.0.0.0:' + port);
    });
  }
})(require("process"));
