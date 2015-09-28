/* */ 
var http = require("http"),
    https = require("https"),
    url = require("url"),
    httpProxy = require("./http-proxy");
module.exports = httpProxy.Server;
module.exports.createProxyServer = module.exports.createServer = module.exports.createProxy = function createProxyServer(options) {
  return new httpProxy.Server(options);
};
