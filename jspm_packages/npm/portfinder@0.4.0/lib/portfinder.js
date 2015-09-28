/* */ 
var fs = require("fs"),
    net = require("net"),
    path = require("path"),
    async = require("async"),
    mkdirp = require("mkdirp").mkdirp;
exports.basePort = 8000;
exports.basePath = '/tmp/portfinder';
exports.getPort = function(options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }
  options.port = options.port || exports.basePort;
  options.host = options.host || null;
  options.server = options.server || net.createServer(function() {});
  function onListen() {
    options.server.removeListener('error', onError);
    options.server.close();
    callback(null, options.port);
  }
  function onError(err) {
    options.server.removeListener('listening', onListen);
    if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') {
      return callback(err);
    }
    exports.getPort({
      port: exports.nextPort(options.port),
      host: options.host,
      server: options.server
    }, callback);
  }
  options.server.once('error', onError);
  options.server.once('listening', onListen);
  options.server.listen(options.port, options.host);
};
exports.getPorts = function(count, options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }
  var lastPort = null;
  async.timesSeries(count, function(index, asyncCallback) {
    if (lastPort) {
      options.port = exports.nextPort(lastPort);
    }
    exports.getPort(options, function(err, port) {
      if (err) {
        asyncCallback(err);
      } else {
        lastPort = port;
        asyncCallback(null, port);
      }
    });
  }, callback);
};
exports.getSocket = function(options, callback) {
  if (!callback) {
    callback = options;
    options = {};
  }
  options.mod = options.mod || 0755;
  options.path = options.path || exports.basePath + '.sock';
  function testSocket() {
    fs.stat(options.path, function(err) {
      if (err) {
        if (err.code == 'ENOENT') {
          callback(null, options.path);
        } else {
          callback(err);
        }
      } else {
        options.path = exports.nextSocket(options.path);
        exports.getSocket(options, callback);
      }
    });
  }
  function createAndTestSocket(dir) {
    mkdirp(dir, options.mod, function(err) {
      if (err) {
        return callback(err);
      }
      options.exists = true;
      testSocket();
    });
  }
  function checkAndTestSocket() {
    var dir = path.dirname(options.path);
    fs.stat(dir, function(err, stats) {
      if (err || !stats.isDirectory()) {
        return createAndTestSocket(dir);
      }
      options.exists = true;
      testSocket();
    });
  }
  return options.exists ? testSocket() : checkAndTestSocket();
};
exports.nextPort = function(port) {
  return port + 1;
};
exports.nextSocket = function(socketPath) {
  var dir = path.dirname(socketPath),
      name = path.basename(socketPath, '.sock'),
      match = name.match(/^([a-zA-z]+)(\d*)$/i),
      index = parseInt(match[2]),
      base = match[1];
  if (isNaN(index)) {
    index = 0;
  }
  index += 1;
  return path.join(dir, base + index + '.sock');
};
