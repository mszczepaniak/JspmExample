/* */ 
(function(Buffer) {
  var url = require("url"),
      util = require("util"),
      qs = require("qs"),
      BufferedStream = require("./buffered-stream");
  var HttpStream = module.exports = function(options) {
    options = options || {};
    BufferedStream.call(this, options.limit);
    if (options.buffer === false) {
      this.buffer = false;
    }
    this.on('pipe', this.pipeState);
  };
  util.inherits(HttpStream, BufferedStream);
  HttpStream.prototype.pipeState = function(source) {
    this.headers = source.headers;
    this.trailers = source.trailers;
    this.method = source.method;
    if (source.url) {
      this.url = this.originalUrl = source.url;
    }
    if (source.query) {
      this.query = source.query;
    } else if (source.url) {
      this.query = ~source.url.indexOf('?') ? qs.parse(url.parse(source.url).query) : {};
    }
  };
})(require("buffer").Buffer);
