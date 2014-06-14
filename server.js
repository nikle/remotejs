/**
 * Server module that receives client request and start server
 */

var http = require('http');
var url = require('url');
var host = "localhost";

function start(route, handle) {

  function onRequest(request, response) {
    var pathname = url.parse(request.url).pathname;
    console.log("server: Request for " + pathname + " received");
    route(handle, pathname, response, request);

  }

  var server = http.createServer(onRequest);
  server.listen(8889);
  console.log("Server has started\nGo to http://" + host + ":8889/");
}

exports.start = start;