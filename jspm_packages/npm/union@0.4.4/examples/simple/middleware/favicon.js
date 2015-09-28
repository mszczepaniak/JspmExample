/* */ 
var crypto = require("crypto"),
    fs = require("fs");
var icon;
exports.md5 = function(str, encoding) {
  return crypto.createHash('md5').update(str).digest(encoding || 'hex');
};
module.exports = function favicon(path, options) {
  var options = options || {},
      path = path || __dirname + '/../public/favicon.ico',
      maxAge = options.maxAge || 86400000;
  return function favicon(req, res, next) {
    if ('/favicon.ico' == req.url) {
      if (icon) {
        res.writeHead(200, icon.headers);
        res.end(icon.body);
      } else {
        fs.readFile(path, function(err, buf) {
          if (err)
            return next(err);
          icon = {
            headers: {
              'Content-Type': 'image/x-icon',
              'Content-Length': buf.length,
              'ETag': '"' + exports.md5(buf) + '"',
              'Cache-Control': 'public, max-age=' + (maxAge / 1000)
            },
            body: buf
          };
          res.writeHead(200, icon.headers);
          res.end(icon.body);
        });
      }
    } else {
      next();
    }
  };
};
