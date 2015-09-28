/* */ 
var assert = require("assert");
var macros = exports;
macros.assertValidResponse = function(err, res) {
  assert.isTrue(!err);
  assert.equal(res.statusCode, 200);
};
