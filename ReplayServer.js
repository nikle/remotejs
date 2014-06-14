/**
 * Replay server daemon
 */
net = require('net');
var db = require("./db");

net.createServer(function(socket){
	socket.name = socket.remoteAddress + ":" + socket.remotePort;
	console.log(socket.name + " connected..");
	
	socket.on('data', function(data){
		data = data.toString('utf-8');
		// Get replay entry for the client
		db.replayHistory.findOne({targetMachine: socket.remoteAddress, status: "Not Started"},
				{logId: 1, targetVersion: 1}, function(error, result){
					if(!error && result){
						console.log("To replay log " + result.logId + " on client " + socket.remoteAddress);
						socket.write(result.logId);
						
						// Update the replay history, status of the record should be "finished"
						db.replayHistory.update({_id: result._id}, {$set: {timestamp: Date.now(), status: "Finished"}});
					}else{
						socket.write("-1");
					}
		});
	});
	
	socket.on('end', function(){
		console.log(socket.name + " left..\n");
	});
	
}).listen(8888);

console.log("Replay server running at port 8888\n");
