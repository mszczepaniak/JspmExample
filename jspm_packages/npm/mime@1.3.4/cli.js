/* */ 
(function(process) {
  var mime = require("./mime");
  var file = process.argv[2];
  var type = mime.lookup(file);
  process.stdout.write(type + '\n');
})(require("process"));
