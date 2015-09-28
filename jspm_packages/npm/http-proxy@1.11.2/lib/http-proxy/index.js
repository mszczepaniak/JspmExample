/* */ 
(function(Buffer) {
  var httpProxy = exports,
      extend = require("util")._extend,
      parse_url = require("url").parse,
      EE3 = require("eventemitter3"),
      http = require("http"),
      https = require("https"),
      web = require("./passes/web-incoming"),
      ws = require("./passes/ws-incoming");
  httpProxy.Server = ProxyServer;
  function createRightProxy(type) {
    return function(options) {
      return function(req, res) {
        var passes = (type === 'ws') ? this.wsPasses : this.webPasses,
            args = [].slice.call(arguments),
            cntr = args.length - 1,
            head,
            cbl;
        if (typeof args[cntr] === 'function') {
          cbl = args[cntr];
          cntr--;
        }
        if (!(args[cntr] instanceof Buffer) && args[cntr] !== res) {
          options = extend({}, options);
          extend(options, args[cntr]);
          cntr--;
        }
        if (args[cntr] instanceof Buffer) {
          head = args[cntr];
        }
        ['target', 'forward'].forEach(function(e) {
          if (typeof options[e] === 'string')
            options[e] = parse_url(options[e]);
        });
        if (!options.target && !options.forward) {
          return this.emit('error', new Error('Must provide a proper URL as target'));
        }
        for (var i = 0; i < passes.length; i++) {
          if (passes[i](req, res, options, head, this, cbl)) {
            break;
          }
        }
      };
    };
  }
  httpProxy.createRightProxy = createRightProxy;
  function ProxyServer(options) {
    EE3.call(this);
    options = options || {};
    options.prependPath = options.prependPath === false ? false : true;
    this.web = this.proxyRequest = createRightProxy('web')(options);
    this.ws = this.proxyWebsocketRequest = createRightProxy('ws')(options);
    this.options = options;
    this.webPasses = Object.keys(web).map(function(pass) {
      return web[pass];
    });
    this.wsPasses = Object.keys(ws).map(function(pass) {
      return ws[pass];
    });
    this.on('error', this.onError, this);
  }
  require("util").inherits(ProxyServer, EE3);
  ProxyServer.prototype.onError = function(err) {
    if (this.listeners('error').length === 1) {
      throw err;
    }
  };
  ProxyServer.prototype.listen = function(port, hostname) {
    var self = this,
        closure = function(req, res) {
          self.web(req, res);
        };
    this._server = this.options.ssl ? https.createServer(this.options.ssl, closure) : http.createServer(closure);
    if (this.options.ws) {
      this._server.on('upgrade', function(req, socket, head) {
        self.ws(req, socket, head);
      });
    }
    this._server.listen(port, hostname);
    return this;
  };
  ProxyServer.prototype.close = function(callback) {
    var self = this;
    if (this._server) {
      this._server.close(done);
    }
    function done() {
      self._server = null;
      if (callback) {
        callback.apply(null, arguments);
      }
    }
    ;
  };
  ProxyServer.prototype.before = function(type, passName, callback) {
    if (type !== 'ws' && type !== 'web') {
      throw new Error('type must be `web` or `ws`');
    }
    var passes = (type === 'ws') ? this.wsPasses : this.webPasses,
        i = false;
    passes.forEach(function(v, idx) {
      if (v.name === passName)
        i = idx;
    });
    if (i === false)
      throw new Error('No such pass');
    passes.splice(i, 0, callback);
  };
  ProxyServer.prototype.after = function(type, passName, callback) {
    if (type !== 'ws' && type !== 'web') {
      throw new Error('type must be `web` or `ws`');
    }
    var passes = (type === 'ws') ? this.wsPasses : this.webPasses,
        i = false;
    passes.forEach(function(v, idx) {
      if (v.name === passName)
        i = idx;
    });
    if (i === false)
      throw new Error('No such pass');
    passes.splice(i++, 0, callback);
  };
})(require("buffer").Buffer);
