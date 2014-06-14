/**
 * Request handler to define handlers for different functions
 */

var fs = require("fs");
var url = require("url");
var queryString = require("querystring");
var util = require("util");
var db = require("./db");

// Open index page for WebCare project. This page is to display current
// recordings and recordings to be replayed.
function webcare(response, request) {
	fs.readFile('index.html', function(error, data) {
		response.writeHead(200, {
			'content-type' : 'text/html'
		});
		response.end(data);
	});
}

// Open the debug console to show the formatted json log given provided log id
function debug(response, request){
	fs.readFile('debug/getlog.html', function(error, data){
		response.writeHead(200, {
			'content-type' : 'text/html'
		});
		response.end(data);
	});
}

// Open code versions updater page
function codeVersionsPage(response, request){
	fs.readFile('codeversions.html', function(error, data){
		response.writeHead(200, {
			'content-type' : 'text/html'
		});
		response.end(data);
	});
}

// Save new recording to mongo db, write empty response to client-side
function saveRecording(response, request) {
	request.setEncoding('utf-8');
	if(request.method == 'POST'){
		var body = '';
		request.on('data', function(data){
			body += data;
		});
		request.on('end', function(){
			var obj = JSON.parse(body);
			var logId = obj.logId;
			var seq = obj.sequence;
			var actualClientIp = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
			obj.targetMachine = actualClientIp;
			
			db.recordings.update(
							{
								targetMachine : obj.targetMachine,
								logId : logId,
								sequence: seq
							},
							obj,
							{
								upsert : true
							},
							function(err, updated) {
								if (err || !updated) {
									console.log("Recording not updated");
								}
							});
		});
	}
	
	var origin = (request.headers.origin || "*");
	response
			.writeHead(
					"204",
					"No Content",
					{
						"access-control-allow-origin" : origin,
						"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
						"access-control-allow-headers" : "content-type, accept",
						"access-control-max-age" : 10, // Seconds.
						"content-length" : 0
					});
	response.end();
}

function sortArrOfObjectsByParam(arrToSort /* array */, strObjParamToSortBy /* string */, sortAscending /* bool(optional, defaults to true) */) {
    if(sortAscending == undefined) sortAscending = true;  // default to true
    
    if(sortAscending) {
        arrToSort.sort(function (a, b) {
            return a[strObjParamToSortBy] > b[strObjParamToSortBy];
        });
    }
    else {
        arrToSort.sort(function (a, b) {
            return a[strObjParamToSortBy] < b[strObjParamToSortBy];
        });
    }
}

// Get all recordings from the recordings collection
function getAllRecordings(response, request){
	// If there is "logid" parameter in get request, just get the specified log
	// Otherwise, return all the recordings.
	var reqQuery = url.parse(request.url).query;
	var obj = queryString.parse(reqQuery);

	var query = {};
	if(obj.logid !== undefined){
		var logid = parseInt(obj.logid);
		query = {logId: logid};
	}
	
	var results = [];
	// group by log id, fetch the maximum duration as its duration, if any sequence has exception, exception=true;
	db.recordings.group(
			{
				key: {logId:1},
				reduce: function(curr, result){
					curSequence = parseInt(curr.sequence);
					if(curSequence > result.sequences){
						result.sequences = curSequence;
					}
					
					if(curr.duration > result.duration){
						result.duration = curr.duration;
					}
					
					if(curr.exception){
						result.exception = true;
					}
					
					result.targetMachine = curr.targetMachine;
					result.codeVersion = curr.codeVersion;
				},
				initial: {sequences:0, duration:0, exception:false, targetMachine:"", codeVersion:""},
				finalize: function(result){
					result.sequences += 1;
				}
			},
			function(error, recordings){
				if(error || !recordings){
					console.log("No recordings are found.");
					var origin = (request.headers.origin || "*");
					response.writeHead("204", "No Content",
							{
								"access-control-allow-origin" : origin,
								"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
								"access-control-allow-headers" : "content-type, accept",
								"access-control-max-age" : 10, // Seconds.
								"content-length" : 0
							});
					response.end();
				}else{
					sortArrOfObjectsByParam(recordings, "logId", true);
					recordings.forEach(function(item){
						var object = new Object();
						object.TargetMachine = item.targetMachine;
						object.LogId = item.logId;
						object.CodeVersion = item.codeVersion;
						object.Sequences = item.sequences;
						object.Exception = item.exception;
						object.Duration = item.duration;
						results.push(object);
					});
					response.writeHead(200, {'content-type': 'application/json'});
					response.end(JSON.stringify(results));
				}
			}
	);
}

// Service to get all the available code versions
function getCodeVersions(response, request){
	var results = [];
	db.codeVersions.find({}, function(error, recordings){
		if(error || !recordings){
			console.log("No code versions are found.");
			var origin = (request.headers.origin || "*");
			response.writeHead("204", "No Content",
					{
						"access-control-allow-origin" : origin,
						"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
						"access-control-allow-headers" : "content-type, accept",
						"access-control-max-age" : 10, // Seconds.
						"content-length" : 0
					});
			response.end();
		}else{
			recordings.forEach(function(item){
				var object = new Object();
				object.version = item.version;
				results.push(object);
			});
			response.writeHead(200, {'content-type': 'application/json'});
			response.end(JSON.stringify(results));
		}
	});
}

//Service to get all the available code versions and urls
function getCompleteCodeVersions(response, request){
	var results = [];
	db.codeVersions.find({}, function(error, recordings){
		if(error || !recordings){
			console.log("No code versions are found.");
			var origin = (request.headers.origin || "*");
			response.writeHead("204", "No Content",
					{
						"access-control-allow-origin" : origin,
						"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
						"access-control-allow-headers" : "content-type, accept",
						"access-control-max-age" : 10, // Seconds.
						"content-length" : 0
					});
			response.end();
		}else{
			recordings.forEach(function(item){
				var object = new Object();
				object.Version = item.version;
				object.URL = item.url;
				results.push(object);
			});
			response.writeHead(200, {'content-type': 'application/json'});
			response.end(JSON.stringify(results));
		}
	});
}


//Service to get all the available target machines from recording table
function getTargetMachines(response, request){
	var results = [];
	db.recordings.distinct('targetMachine', function(error, recordings){
		if(error || !recordings){
			console.log("No target machines are found.");
			var origin = (request.headers.origin || "*");
			response.writeHead("204", "No Content",
					{
						"access-control-allow-origin" : origin,
						"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
						"access-control-allow-headers" : "content-type, accept",
						"access-control-max-age" : 10, // Seconds.
						"content-length" : 0
					});
			response.end();
		}else{
			recordings.forEach(function(item){
				var object = new Object();
				object.machine = item;
				results.push(object);
			});
			response.writeHead(200, {'content-type': 'application/json'});
			response.end(JSON.stringify(results));
		}
	});
}

// Add selected recordings to the "to-replay" list
function toReplay(response, request){
	var parsedUrl = url.parse(request.url, true);
	var queryObj = parsedUrl.query;
	var recordings = JSON.parse(queryObj.recordings);
	var version = JSON.parse(queryObj.version).version;
	var machine = JSON.parse(queryObj.machine).machine;

	for(var i=0; i<recordings.length; i++){
		var item = recordings[i];
		db.replayHistory.insert({timestamp: Date.now(),
            targetMachine: machine,
            logId: item.LogId,
            duration: item.Duration,
            targetVersion: version,
            status: "Not Started"
            });
	}
	
	console.log(recordings.length + " recordings have been added to the replay list");
	response.writeHead("204", "No Content",{ "content-length" : 0});
	response.end();
	
}

// Get replay history
function getReplayHistory(response, request){
	var results = [];
	db.replayHistory.find({}).sort({timestamp:-1}, function(error, replays){
		if(error || !replays){
			console.log("No replay history are found.");
			var origin = (request.headers.origin || "*");
			response.writeHead("204", "No Content",
					{
						"access-control-allow-origin" : origin,
						"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
						"access-control-allow-headers" : "content-type, accept",
						"access-control-max-age" : 10, // Seconds.
						"content-length" : 0
					});
			response.end();
		}else{
			replays.forEach(function(item){
				var object = new Object();
				object.Timestamp = timeConverter(item.timestamp);
				object.TargetMachine = item.targetMachine;
				object.LogId = item.logId;
				object.TargetVersion = item.targetVersion;
				object.Status = item.status;
				results.push(object);
			});
			response.writeHead(200, {'content-type': 'application/json'});
			response.end(JSON.stringify(results));
		}
	});
}

// Get one replay history record to replay
function replayOneRecord(response, request){
	var actualClientIp = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
	
	db.replayHistory.findOne({targetMachine: actualClientIp, status: "Not Started"},
			{logId: 1, targetVersion: 1, duration: 1}, function(error, result){
				if(!error && result){
					console.log("To replay log " + result.logId + " on client " + actualClientIp);
					
					// Get corresponding application server url according to the code version
					db.codeVersions.findOne({version:result.targetVersion}, {url:1}, function(error, resultset){
						var object = new Object();
						object.url = resultset.url;
						object.id = result.logId;
						object.duration = result.duration;
						
						// Update the replay history, status of the record should be "finished"
						db.replayHistory.update({_id: result._id}, {$set: {timestamp: Date.now(), status: "Finished"}});

						response.writeHead(200, {'content-type': 'application/json'});
						response.end(JSON.stringify(object));
					});
				}else{
					console.log("No replay history are found.");
					var origin = (request.headers.origin || "*");
					response.writeHead("204", "No Content",
							{
								"access-control-allow-origin" : origin,
								"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
								"access-control-allow-headers" : "content-type, accept",
								"access-control-max-age" : 10, // Seconds.
								"content-length" : 0
							});
					response.end();
				}
	});
}

function timeConverter(timestamp){
	var date = new Date(timestamp);
	return (date.getMonth() + 1)+ "/" + date.getDate() + "/" + date.getFullYear() + " "
	       + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
}

// Open javascript file if requested
function serveFileJS(response, request) {
	var pathname = url.parse(request.url).pathname;
	fs.readFile(pathname.substring(1, pathname.length), function(error, data) {
		response.writeHead(200, {
			'content-type' : 'text/javascript'
		});
		response.end(data);
	});
}

// Open json file if requested
function serveFileJSON(response, request) {
	var pathname = url.parse(request.url).pathname;
	fs.readFile(pathname.substring(1, pathname.length), function(error, data) {
		response.writeHead(200, {
			'content-type' : 'text/json'
		});
		response.end(data);
	});
}

// Open css file if requested
function serveFileCSS(response, request) {
	var pathname = url.parse(request.url).pathname;
	fs.readFile(pathname.substring(1, pathname.length), function(error, data) {
		response.writeHead(200, {
			'content-type' : 'text/css'
		});
		response.end(data);
	});
}

// Open image file if requested
function serveFileImage(response, request) {
	// list of supported image types
	var imageTypeMimeMap = new Object();
	imageTypeMimeMap.png = "image/png";
	imageTypeMimeMap.jpg = "image/jpeg";
	imageTypeMimeMap.jpeg = "image/jpeg";

	var pathname = url.parse(request.url).pathname;
	var filetype = pathname.substring(pathname.lastIndexOf(".") + 1,
			pathname.length);
	console.log(filetype);
	console.log(imageTypeMimeMap[filetype]);
	console.log(pathname);
	fs.stat("." + pathname, function(err, stat) {
		console.log(stat);
		response.writeHead(200, {
			'content-type' : imageTypeMimeMap[filetype],
			'content-length' : stat.size
		});

		var rs = fs.createReadStream("." + pathname);
		console.log(rs);
		util.pump(rs, response, function(err) {
			if (err) {
				console.log(err);
				throw err;
			}
		});
	});
}

// The following code is for empirical study
function regression(response, request) {
	request.setEncoding('utf-8');
	if(request.method == 'POST'){
		var body = '';
		request.on('data', function(data){
			body += data;
		});
		request.on('end', function(){
			var obj = JSON.parse(body);
			db.regression_test.update(
					{
						id: obj.id
					},
					obj,
					{
						upsert : true
					},
					function(err, updated) {
						if (err || !updated) {
							console.log("Recording not updated");
						}
					});
		
		});
	}
	
	var origin = (request.headers.origin || "*");
	response
			.writeHead(
					"204",
					"No Content",
					{
						"access-control-allow-origin" : origin,
						"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
						"access-control-allow-headers" : "content-type, accept",
						"access-control-max-age" : 10, // Seconds.
						"content-length" : 0
					});
	response.end();


	
}

// Get corresponding recording given the record id
function getRecording(response, request){
	var reqQuery = url.parse(request.url).query;
	var obj = queryString.parse(reqQuery);
	//var id = parseInt(obj.id);
	var id = obj.id;
	var seq = obj.seq;
	
	db.recordings.findOne({logId:id, sequence:seq},
			{log: 1}, function(error, result){
				var origin = (request.headers.origin || "*");
				if(!error && result){
					console.log("To replay log " + id );
					response.writeHead(200, 
							{
						"access-control-allow-origin" : origin,
						"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
						"access-control-allow-headers" : "content-type, accept",
						"access-control-max-age" : 10, // Seconds.
						'content-type': 'application/json'
					});
					response.end(JSON.stringify(result.log));
				}else{
					console.log("No replay history are found.");
					response.writeHead("204", "No Content",
							{
								"access-control-allow-origin" : origin,
								"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
								"access-control-allow-headers" : "content-type, accept",
								"access-control-max-age" : 10, // Seconds.
								"content-length" : 0
							});
					response.end();
				}
	});
}

// Update code version and corresponding url
function updateCodeVersion(response, request){
	var parsedUrl = url.parse(request.url, true);
	var queryObj = parsedUrl.query;
	var version = queryObj.version;
	var newurl = queryObj.url;
	
	db.codeVersions.update(
			{
				version : version
			},
			{version:version, url:newurl},
			{
				upsert : true
			},
			function(err, updated) {
				if (err || !updated) {
					console.log("Code versions not updated");
				}
			});
	
	var origin = (request.headers.origin || "*");
	response
			.writeHead(
					"204",
					"No Content",
					{
						"access-control-allow-origin" : origin,
						"access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
						"access-control-allow-headers" : "content-type, accept",
						"access-control-max-age" : 10, // Seconds.
						"content-length" : 0
					});
	response.end();

}

////Treemap visualization with d3.js
//function treemap(response, request){
//	// Get all the recordings
//	var results = [];
//	db.recordings.find({},{logId:1, exception:1, targetMachine:1}, function(error, recordings){
//		var dict = {};
//		dict.name = "God Mie v587!";
//		dict.result = -1;
//		dict.children = [];
//		
//		if(error || !recordings){
//			console.log("No recordings are found.");
//		}else{
//			var machines = {};
//			recordings.forEach(function(item){
//				var machine = item.targetMachine;
//				var record = new Object();
//				record.name = item.logId;
//				record.size = 1000;
//				
//				var flag;
//				if(item.exception){
//					record.result = 0;
//					flag = "failed";
//				}else{
//					record.result = 1;
//					flag = "passed";
//				}
//				
//				record.html = "<a href='/?logid=" + item.logId + "' target='_blank'>" + flag + "</a>";
//				
//				if(!machines[machine]){
//					machines[machine] = [];
//				}
//				machines[machine].push(record);
//			});
//			
//			for (var m in machines){
//				var machineNode = {};
//				machineNode.name = m;
//				machineNode.result = -1;
//				machineNode.html = m;
//				machineNode.children = machines[m];
//				
//				dict.children.push(machineNode);
//			}
//		}
//	
//		// Write to json file
//		var outputFile = "treemap/data.json";
//		fs.writeFile(outputFile, JSON.stringify(dict, null, 4), function(err){
//			if(err){
//				console.log(err);
//			}else{
//				console.log("JSON saved to " + outputFile);
//			}
//		});
//		
//		// Load treemap view html with given json file
//		var htmlFile = "treemap/treemap.html";
//		fs.readFile(htmlFile, function(error, data) {
//			response.writeHead(200, {
//				'content-type' : 'text/html'
//			});
//			response.end(data);
//		});
//		
//	});
//	
//	
//	
//}

function getLogs(response,request){
    var reqQuery = url.parse(request.url).query;
    var obj = queryString.parse(reqQuery);
    //var id = parseInt(obj.id);
    var id = obj.id;

    console.log("id is "+ (typeof id === 'string'));

    var results=[];
    var options ={"sort":"sequence"};

    db.recordings.find({logId:id},{log:1,sequence:1},options,function(error, replays){
        var origin =(request.headers.origin || "*");
        if(error|| !replays){
            console.log("No code versions are found.");
            var origin = (request.headers.origin || "*");
            response.writeHead("204", "No Content",
                {
                    "access-control-allow-origin" : origin,
                    "access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
                    "access-control-allow-headers" : "content-type, accept",
                    "access-control-max-age" : 10, // Seconds.
                    "content-length" : 0
                });
            response.end();

        }else{
            replays.forEach(function(item){
                console.log("To replay log " + item.sequence);
                results.push(item);
            });

            response.writeHead(200, {
                "access-control-allow-origin" : origin,
                "access-control-allow-methods" : "GET, POST, PUT, DELETE, OPTIONS",
                "access-control-allow-headers" : "content-type, accept",
                "access-control-max-age" : 10, // Seconds.
                'content-type': 'application/json'
            });

            //console.log(JSON.stringify(results));

            response.end(JSON.stringify(results));
        }
    });
}


// Treemap visualization with jquery widget
function treemap(response, request){
	// Get all the recordings
	var results = [];
	db.recordings.group(
			{
				key: {logId:1},
				reduce: function(curr, result){
					curSequence = parseInt(curr.sequence);
					if(curSequence > result.sequences){
						result.sequences = curSequence;
					}
					
					if(curr.duration > result.duration){
						result.duration = curr.duration;
					}
					
					if(curr.exception){
						result.exception = true;
					}
					
					result.targetMachine = curr.targetMachine;
					result.codeVersion = curr.codeVersion;
				},
				initial: {sequences:0, duration:0, exception:false, targetMachine:"", codeVersion:""},
				finalize: function(result){
					result.sequences += 1;
				}
			},
			function(error, recordings){
		var dict = {};
		dict.data = [];
		
		if(error || !recordings){
			console.log("No recordings are found.");
		}else{
			var machines = {};
			var index = 0;
			recordings.forEach(function(item){
				var machine = item.targetMachine;
				var record = new Object();
				
				if(!machines[machine]){
					machines[machine] = 1;
					record.label = machine;
					record.value = 1;
					record.parent = null;
					record.data = null;
					dict.data.push(record);
				}
				
				record = new Object();
				record.label = item.logId;
				record.value = 1;
				record.parent = machine;
				var dataObj = new Object();
				dataObj.machineName = machine;
				dataObj.codeVersion = item.codeVersion;
				dataObj.duration = item.duration;
				
				if(index === 0){
					// Indicate the first one is the latest execution
					dataObj.latest = 1;
				}else{
					dataObj.latest = 0;
				}
				
				if(item.exception){
					dataObj.result = "failed";
				}else{
					dataObj.result = "passed";
				}
				
				record.data = dataObj;
				
				dict.data.push(record);
				index ++;
			});
		}
	
		// Write to json file
		var outputFile = "treemap/data.json";
		fs.writeFile(outputFile, JSON.stringify(dict, null, 4), function(err){
			if(err){
				console.log(err);
			}else{
				console.log("JSON saved to " + outputFile);
			}
		});
		
		// Load treemap view html with given json file
		var htmlFile = "treemap/treemap.html";
		fs.readFile(htmlFile, function(error, data) {
			response.writeHead(200, {
				'content-type' : 'text/html'
			});
			response.end(data);
		});
		
	});
	
	
	
}

// Define module names
exports.webcare = webcare;
exports.saveRecording = saveRecording;
exports.getAllRecordings = getAllRecordings;
exports.getRecording = getRecording;
exports.getCodeVersions = getCodeVersions;
exports.toReplay = toReplay;
exports.getReplayHistory = getReplayHistory;
exports.serveFileJS = serveFileJS;
exports.serveFileCSS = serveFileCSS;
exports.serveFileImage = serveFileImage;
exports.serveFileJSON = serveFileJSON;
exports.replayOneRecord = replayOneRecord;
exports.getTargetMachines = getTargetMachines;

exports.codeVersionsPage = codeVersionsPage;
exports.getCompleteCodeVersions = getCompleteCodeVersions;
exports.updateCodeVersion = updateCodeVersion;

exports.treemap = treemap;
exports.debug = debug;
exports.getLogs = getLogs;


exports.regression = regression;

