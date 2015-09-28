/* */ 
var union = exports;
exports.version = require("../package.json!systemjs-json").version;
union.BufferedStream = require("./buffered-stream");
union.HttpStream = require("./http-stream");
union.ResponseStream = require("./response-stream");
union.RoutingStream = require("./routing-stream");
union.createServer = require("./core").createServer;
union.errorHandler = require("./core").errorHandler;
