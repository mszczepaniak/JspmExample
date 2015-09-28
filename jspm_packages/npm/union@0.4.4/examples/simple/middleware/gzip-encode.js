/* */ 
(function(process) {
  var spawn = require("child_process").spawn,
      util = require("util"),
      ResponseStream = require("../../lib").ResponseStream;
  var GzipEncode = module.exports = function GzipEncode(options) {
    ResponseStream.call(this, options);
    if (compression) {
      process.assert(compression >= 1 && compression <= 9);
      this.compression = compression;
    }
    this.on('pipe', this.encode);
  };
  util.inherits(GzipEncode, ResponseStream);
  GzipEncode.prototype.encode = function(source) {
    this.source = source;
  };
  GzipEncode.prototype.pipe = function(dest) {
    if (!this.source) {
      throw new Error('GzipEncode is only pipeable once it has been piped to');
    }
    this.encoder = spawn('gzip', ['-' + this.compression]);
    this.encoder.stdout.pipe(dest);
    this.encoder.stdin.pipe(this.source);
  };
  inherits(GzipEncoderStack, StreamStack);
  exports.GzipEncoderStack = GzipEncoderStack;
  GzipEncoderStack.prototype.compression = 6;
})(require("process"));
