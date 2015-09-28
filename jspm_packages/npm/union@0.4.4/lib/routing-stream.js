/* */ 
var util = require("util"),
    union = require("./index"),
    RequestStream = require("./request-stream"),
    ResponseStream = require("./response-stream");
var RoutingStream = module.exports = function(options) {
  options = options || {};
  RequestStream.call(this, options);
  this.before = options.before || [];
  this.after = options.after || [];
  this.response = options.response || options.res;
  this.headers = options.headers || {'x-powered-by': 'union ' + union.version};
  this.target = new ResponseStream({
    response: this.response,
    headers: this.headers
  });
  this.once('pipe', this.route);
};
util.inherits(RoutingStream, RequestStream);
RoutingStream.prototype.route = function(req) {
  var self = this,
      after,
      error,
      i;
  this.target.writable = req.method !== 'HEAD';
  after = [this.target].concat(this.after, this.response);
  for (i = 0; i < after.length - 1; i++) {
    after[i].req = req;
    after[i + 1].req = req;
    after[i].res = this.response;
    after[i + 1].res = this.response;
    after[i].pipe(after[i + 1]);
    after[i].on('error', this.onError);
  }
  function notFound() {
    error = new Error('Not found');
    error.status = 404;
    self.onError(error);
  }
  (function dispatch(i) {
    if (self.target.modified) {
      return;
    } else if (++i === self.before.length) {
      return notFound();
    }
    self.target.once('next', dispatch.bind(null, i));
    if (self.before[i].length === 3) {
      self.before[i](self, self.target, function(err) {
        if (err) {
          self.onError(err);
        } else {
          self.target.emit('next');
        }
      });
    } else {
      self.before[i](self, self.target);
    }
  })(-1);
};
RoutingStream.prototype.onError = function(err) {
  this.emit('error', err);
};
