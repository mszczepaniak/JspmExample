/* */ 
var http = require("http"),
    https = require("https"),
    common = require("../common"),
    passes = exports;
var passes = exports;
[function checkMethodAndHeader(req, socket) {
  if (req.method !== 'GET' || !req.headers.upgrade) {
    socket.destroy();
    return true;
  }
  if (req.headers.upgrade.toLowerCase() !== 'websocket') {
    socket.destroy();
    return true;
  }
}, function XHeaders(req, socket, options) {
  if (!options.xfwd)
    return;
  var values = {
    for: req.connection.remoteAddress || req.socket.remoteAddress,
    port: common.getPort(req),
    proto: common.hasEncryptedConnection(req) ? 'wss' : 'ws'
  };
  ['for', 'port', 'proto'].forEach(function(header) {
    req.headers['x-forwarded-' + header] = (req.headers['x-forwarded-' + header] || '') + (req.headers['x-forwarded-' + header] ? ',' : '') + values[header];
  });
}, function stream(req, socket, options, head, server, clb) {
  common.setupSocket(socket);
  if (head && head.length)
    socket.unshift(head);
  var proxyReq = (common.isSSL.test(options.target.protocol) ? https : http).request(common.setupOutgoing(options.ssl || {}, options, req));
  proxyReq.on('error', onOutgoingError);
  proxyReq.on('response', function(res) {
    if (!res.upgrade)
      socket.end();
  });
  proxyReq.on('upgrade', function(proxyRes, proxySocket, proxyHead) {
    proxySocket.on('error', onOutgoingError);
    proxySocket.on('end', function() {
      server.emit('close', proxyRes, proxySocket, proxyHead);
    });
    socket.on('error', function() {
      proxySocket.end();
    });
    common.setupSocket(proxySocket);
    if (proxyHead && proxyHead.length)
      proxySocket.unshift(proxyHead);
    socket.write(Object.keys(proxyRes.headers).reduce(function(head, key) {
      var value = proxyRes.headers[key];
      if (!Array.isArray(value)) {
        head.push(key + ': ' + value);
        return head;
      }
      for (var i = 0; i < value.length; i++) {
        head.push(key + ': ' + value[i]);
      }
      return head;
    }, ['HTTP/1.1 101 Switching Protocols']).join('\r\n') + '\r\n\r\n');
    proxySocket.pipe(socket).pipe(proxySocket);
    server.emit('open', proxySocket);
    server.emit('proxySocket', proxySocket);
  });
  return proxyReq.end();
  function onOutgoingError(err) {
    if (clb) {
      clb(err, req, socket);
    } else {
      server.emit('error', err, req, socket);
    }
    socket.end();
  }
}].forEach(function(func) {
  passes[func.name] = func;
});
