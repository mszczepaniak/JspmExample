/* */ 
'use strict';
var fs = require("fs"),
    union = require("union"),
    ecstatic = require("ecstatic"),
    httpProxy = require("http-proxy"),
    corser = require("corser");
exports.HttpServer = exports.HTTPServer = HttpServer;
exports.createServer = function(options) {
  return new HttpServer(options);
};
function HttpServer(options) {
  options = options || {};
  if (options.root) {
    this.root = options.root;
  } else {
    try {
      fs.lstatSync('./public');
      this.root = './public';
    } catch (err) {
      this.root = './';
    }
  }
  this.headers = options.headers || {};
  this.cache = options.cache === undefined ? 3600 : options.cache;
  this.showDir = options.showDir !== 'false';
  this.autoIndex = options.autoIndex !== 'false';
  this.contentType = options.contentType || 'application/octet-stream';
  if (options.ext) {
    this.ext = options.ext === true ? 'html' : options.ext;
  }
  var before = options.before ? options.before.slice() : [];
  before.push(function(req, res) {
    if (options.logFn) {
      options.logFn(req, res);
    }
    res.emit('next');
  });
  if (options.cors) {
    this.headers['Access-Control-Allow-Origin'] = '*';
    this.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Range';
    before.push(corser.create());
  }
  if (options.robots) {
    before.push(function(req, res) {
      if (req.url === '/robots.txt') {
        res.setHeader('Content-Type', 'text/plain');
        var robots = options.robots === true ? 'User-agent: *\nDisallow: /' : options.robots.replace(/\\n/, '\n');
        return res.end(robots);
      }
      res.emit('next');
    });
  }
  before.push(ecstatic({
    root: this.root,
    cache: this.cache,
    showDir: this.showDir,
    autoIndex: this.autoIndex,
    defaultExt: this.ext,
    contentType: this.contentType,
    handleError: typeof options.proxy !== 'string'
  }));
  if (typeof options.proxy === 'string') {
    var proxy = httpProxy.createProxyServer({});
    before.push(function(req, res) {
      proxy.web(req, res, {
        target: options.proxy,
        changeOrigin: true
      });
    });
  }
  var serverOptions = {
    before: before,
    headers: this.headers,
    onError: function(err, req, res) {
      if (options.logFn) {
        options.logFn(req, res, err);
      }
      res.end();
    }
  };
  if (options.https) {
    serverOptions.https = options.https;
  }
  this.server = union.createServer(serverOptions);
}
HttpServer.prototype.listen = function() {
  this.server.listen.apply(this.server, arguments);
};
HttpServer.prototype.close = function() {
  return this.server.close();
};