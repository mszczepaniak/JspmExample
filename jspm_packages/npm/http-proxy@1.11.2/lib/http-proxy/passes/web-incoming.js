/* */ 
var http = require("http"),
    https = require("https"),
    web_o = require("./web-outgoing"),
    common = require("../common"),
    passes = exports;
web_o = Object.keys(web_o).map(function(pass) {
  return web_o[pass];
});
[function deleteLength(req, res, options) {
  if ((req.method === 'DELETE' || req.method === 'OPTIONS') && !req.headers['content-length']) {
    req.headers['content-length'] = '0';
  }
}, function timeout(req, res, options) {
  if (options.timeout) {
    req.socket.setTimeout(options.timeout);
  }
}, function XHeaders(req, res, options) {
  if (!options.xfwd)
    return;
  var encrypted = req.isSpdy || common.hasEncryptedConnection(req);
  var values = {
    for: req.connection.remoteAddress || req.socket.remoteAddress,
    port: common.getPort(req),
    proto: encrypted ? 'https' : 'http'
  };
  ['for', 'port', 'proto'].forEach(function(header) {
    req.headers['x-forwarded-' + header] = (req.headers['x-forwarded-' + header] || '') + (req.headers['x-forwarded-' + header] ? ',' : '') + values[header];
  });
}, function stream(req, res, options, _, server, clb) {
  server.emit('start', req, res, options.target);
  if (options.forward) {
    var forwardReq = (options.forward.protocol === 'https:' ? https : http).request(common.setupOutgoing(options.ssl || {}, options, req, 'forward'));
    (options.buffer || req).pipe(forwardReq);
    if (!options.target) {
      return res.end();
    }
  }
  var proxyReq = (options.target.protocol === 'https:' ? https : http).request(common.setupOutgoing(options.ssl || {}, options, req));
  proxyReq.on('socket', function(socket) {
    if (server) {
      server.emit('proxyReq', proxyReq, req, res, options);
    }
  });
  if (options.proxyTimeout) {
    proxyReq.setTimeout(options.proxyTimeout, function() {
      proxyReq.abort();
    });
  }
  req.on('aborted', function() {
    proxyReq.abort();
  });
  req.on('error', proxyError);
  proxyReq.on('error', proxyError);
  function proxyError(err) {
    if (clb) {
      clb(err, req, res, options.target);
    } else {
      server.emit('error', err, req, res, options.target);
    }
  }
  (options.buffer || req).pipe(proxyReq);
  proxyReq.on('response', function(proxyRes) {
    if (server) {
      server.emit('proxyRes', proxyRes, req, res);
    }
    for (var i = 0; i < web_o.length; i++) {
      if (web_o[i](req, res, proxyRes, options)) {
        break;
      }
    }
    proxyRes.on('end', function() {
      server.emit('end', req, res, proxyRes);
    });
    proxyRes.pipe(res);
  });
}].forEach(function(func) {
  passes[func.name] = func;
});
