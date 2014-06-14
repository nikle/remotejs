/**
 * Entry point
 */

var server = require("./server");
var router = require("./router");
var requestHandlers = require("./requestHandlers");

var handle = {}
handle["/"] = requestHandlers.webcare;
handle["/start"] = requestHandlers.webcare;
handle["/saveRecording"] = requestHandlers.saveRecording;
handle["/getAllRecordings"] = requestHandlers.getAllRecordings;
handle["/getCodeVersions"] = requestHandlers.getCodeVersions;
handle["/toReplay"] = requestHandlers.toReplay;
handle["/getReplayHistory"] = requestHandlers.getReplayHistory;
handle["/replayOneRecord"] = requestHandlers.replayOneRecord;
handle["/*.js"] = requestHandlers.serveFileJS;
handle["/*.css"] = requestHandlers.serveFileCSS;
handle["/*.json"] = requestHandlers.serveFileJSON;
handle["/image"] = requestHandlers.serveFileImage;

handle['/getRecording'] = requestHandlers.getRecording;
handle['/getTargetMachines'] = requestHandlers.getTargetMachines;
handle['/regression'] = requestHandlers.regression;

// Open codeversions.html page
handle["/codeversions"] = requestHandlers.codeVersionsPage;
handle["/getCompleteCodeVersions"] = requestHandlers.getCompleteCodeVersions;
handle["/updateCodeVersion"] = requestHandlers.updateCodeVersion;

handle["/treemap"] = requestHandlers.treemap;
handle["/debug"] = requestHandlers.debug;
handle["/getLogs"]=requestHandlers.getLogs;

server.start(router.route, handle);