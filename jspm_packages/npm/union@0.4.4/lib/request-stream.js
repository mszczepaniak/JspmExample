/* */ 
var url = require("url"),
    util = require("util"),
    qs = require("qs"),
    HttpStream = require("./http-stream");
var RequestStream = module.exports = function(options) {
  options = options || {};
  HttpStream.call(this, options);
  this.on('pipe', this.pipeRequest);
  this.request = options.request;
};
util.inherits(RequestStream, HttpStream);
RequestStream.prototype.pipeRequest = function(source) {
  this.url = this.originalUrl = source.url;
  this.method = source.method;
  this.httpVersion = source.httpVersion;
  this.httpVersionMajor = source.httpVersionMajor;
  this.httpVersionMinor = source.httpVersionMinor;
  this.setEncoding = source.setEncoding;
  this.connection = source.connection;
  this.socket = source.socket;
  if (source.query) {
    this.query = source.query;
  } else {
    this.query = ~source.url.indexOf('?') ? qs.parse(url.parse(source.url).query) : {};
  }
};
['setEncoding'].forEach(function(method) {
  RequestStream.prototype[method] = function() {
    return this.request[method].apply(this.request, arguments);
  };
});
