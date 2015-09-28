/* */ 
var common = exports,
    url = require("url"),
    extend = require("util")._extend,
    required = require("requires-port");
var upgradeHeader = /(^|,)\s*upgrade\s*($|,)/i,
    isSSL = /^https|wss/;
common.isSSL = isSSL;
common.setupOutgoing = function(outgoing, options, req, forward) {
  outgoing.port = options[forward || 'target'].port || (isSSL.test(options[forward || 'target'].protocol) ? 443 : 80);
  ['host', 'hostname', 'socketPath', 'pfx', 'key', 'passphrase', 'cert', 'ca', 'ciphers', 'secureProtocol'].forEach(function(e) {
    outgoing[e] = options[forward || 'target'][e];
  });
  outgoing.method = req.method;
  outgoing.headers = extend({}, req.headers);
  if (options.headers) {
    extend(outgoing.headers, options.headers);
  }
  if (options.auth) {
    outgoing.auth = options.auth;
  }
  if (isSSL.test(options[forward || 'target'].protocol)) {
    outgoing.rejectUnauthorized = (typeof options.secure === "undefined") ? true : options.secure;
  }
  outgoing.agent = options.agent || false;
  outgoing.localAddress = options.localAddress;
  if (!outgoing.agent) {
    outgoing.headers = outgoing.headers || {};
    if (typeof outgoing.headers.connection !== 'string' || !upgradeHeader.test(outgoing.headers.connection)) {
      outgoing.headers.connection = 'close';
    }
  }
  var target = options[forward || 'target'];
  var targetPath = target && options.prependPath !== false ? (target.path || '') : '';
  var outgoingPath = !options.toProxy ? (url.parse(req.url).path || '/') : req.url;
  outgoingPath = !options.ignorePath ? outgoingPath : '/';
  outgoing.path = common.urlJoin(targetPath, outgoingPath);
  if (options.changeOrigin) {
    outgoing.headers.host = required(outgoing.port, options[forward || 'target'].protocol) && !hasPort(outgoing.host) ? outgoing.host + ':' + outgoing.port : outgoing.host;
  }
  return outgoing;
};
common.setupSocket = function(socket) {
  socket.setTimeout(0);
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 0);
  return socket;
};
common.getPort = function(req) {
  var res = req.headers.host ? req.headers.host.match(/:(\d+)/) : '';
  return res ? res[1] : common.hasEncryptedConnection(req) ? '443' : '80';
};
common.hasEncryptedConnection = function(req) {
  return Boolean(req.connection.encrypted || req.connection.pair);
};
common.urlJoin = function() {
  var args = Array.prototype.slice.call(arguments),
      lastIndex = args.length - 1,
      last = args[lastIndex],
      lastSegs = last.split('?'),
      retSegs;
  args[lastIndex] = lastSegs.shift();
  retSegs = [args.filter(Boolean).join('/').replace(/\/+/g, '/').replace(/:\//g, '://')];
  retSegs.push.apply(retSegs, lastSegs);
  return retSegs.join('?');
};
function hasPort(host) {
  return !!~host.indexOf(':');
}
;
