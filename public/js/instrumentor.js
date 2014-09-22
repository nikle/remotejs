var serverip = "localhost";
var serverport = "8889";
var updateUrl = 'http://' + serverip + ':' + serverport + '/saveRecording';
var getUrl = 'http://' + serverip + ':' + serverport + '/getRecording';

//console.log("cookie is " +document.cookie);
function setCookie(cname,cvalue)
{
	document.cookie = cname + "=" + cvalue;
	console.log(document.cookie);
}

function deleteCookie(c_name) {
    document.cookie = encodeURIComponent(c_name) + "=deleted; expires=" + new Date(0).toUTCString();
}

// Define code version in the application code. If not defined, use '1.0.0.0" as default value. 
var codeVersion;
try{
	if(typeof codeVersion == 'undefined'){
		codeVersion = '1.0.0.0';
	}
}catch(err){
	codeVersion = '1.0.0.0';
}

// Capture unhandled exceptions. And update exception flag with each recording
var withException = false;

// Override window.onerror function to get unhandled exceptions
var oldOnError = window.onerror;
window.onerror = function(message, url, line) {
	withException = true;

	if (oldOnError) {
		return oldOnError(message, url, line);
	}

	return false;
};

// Override console.error function to get errors
var oldErrorFunc = window.console.error.bind(console);

window.console.error = function(object) {
	withException = true;
	oldErrorFunc(object);
};

// Check whether the current window is the topmost window
function checkTopMostWindow(){
	if(window.top != window.self){
		return false;
	}else{
		return true;
	}
}

var nativeDate = Date;
var nativeSetTimeout = setTimeout;
var nativeSetInterval = setInterval;
var nativeXMLHttpRequest = XMLHttpRequest;

(function() {	
	var replay_session_token = 'reanimator_replay_' + window.top.reanimator_tab_id;
	var capture_session_token = 'reanimator_capture_' + window.top.reanimator_tab_id;
	var isTopWindow = checkTopMostWindow();

	function unloading(){

		if(sessionStorage.getItem(capture_session_token) != null){
			var id = sessionStorage[capture_session_token];
			var seq = sessionStorage[capture_session_token + '_seq'];
			
			var xhr = new nativeXMLHttpRequest();
			var duration = nativeDate.now() - id;
			var obj = {logId: id, 
					   sequence: seq,
					   codeVersion: codeVersion, 
					   exception: withException,
					   duration: duration,
					   log: JSON.stringify(Reanimator.flush())};
			var string = JSON.stringify(obj);
			xhr.open('POST', updateUrl, false);
			xhr.setRequestHeader("Content-Type", "application/json;charset=utf-8");
			xhr.send(string);
			
			sessionStorage[capture_session_token + '_seq'] = parseInt(sessionStorage[capture_session_token + '_seq']) + 1;
		}else{
			// Replay
			sessionStorage[replay_session_token + '_seq'] = parseInt(sessionStorage[replay_session_token + '_seq']) + 1;
		}
	}

	/*var flag = true;
	// Record sequence id (which page is loaded) in session
	$(window.top).on('beforeunload', function(e) {
		//console.log(document.cookie);
		// If it is capture phase, save log to database, update sequence 
		flag = false;
		unloading();
		return null;
	});*/


	/*$(window.top).on('unload', function(e) {
		//console.log(document.cookie);
		// If it is capture phase, save log to database, update sequence 
		if(flag){
			unloading();
			return null;
		}		
	});*/

	if (typeof window.remotejs_replay_id != 'undefined' || sessionStorage.getItem(replay_session_token) != null) {
		
		if(isTopWindow){

			// Get recordings from database if it is the topmost window
			if(typeof window.remotejs_replay_id != 'undefined' && sessionStorage.getItem(replay_session_token) === null){
				// First time to launch an app, record the replay id in the session
				deleteCookie("captureid");
				deleteCookie("replayid");

                /*if(query.indexOf('&event=') <0){
                    query = query.split(REPLAY_TOKEN);
                    id = query[1];
                }else{

                    id = query.substring(8,query.indexOf('&event='));
                    console.log(id);
                    window.eventID = query.substring(query.indexOf('&event=')+7);
                    console.log(window.eventID);
                }*/

				setCookie('replayid',window.remotejs_replay_id);
				sessionStorage[replay_session_token] = window.remotejs_replay_id;
				sessionStorage[replay_session_token + '_seq'] = 0;

			}
			
			var id = sessionStorage[replay_session_token];
            /*if(query.indexOf('&event=')>=0){
                window.eventID = query.substring(query.indexOf('&event=')+7);
            }*/

			seq = sessionStorage[replay_session_token + '_seq'];
			var xhr = new nativeXMLHttpRequest();
			xhr.open('GET', getUrl + "?id=" + id + "&seq=" + seq, false);
			xhr.onreadystatechange = function(){
				if(xhr.readyState == 4){
					if(xhr.status == 200){
						log = JSON.parse(xhr.responseText);
						len = log.length;
						console.log("# Replay log length: " + (len / 1024).toFixed(2) + "KB");
						Reanimator.replay(JSON.parse(log), {
									delay : 'realtime'
						}, isTopWindow);
					}else{
						console.log("No recordings are found!");
					}
				}
			};
			xhr.send();
		}else{
			// Only to call beforeReplay method. Replay is only started in window.top window
			Reanimator.replay(window.top.Reanimator.state.log, {delay: 'realtime'}, isTopWindow);
		}
	} else {
		// refactor has no impact on capture phase;
		// If topmost window, start a new id and capture. Update to server periodically
		if(isTopWindow){
			if (sessionStorage.getItem(capture_session_token) === null) {
				//First time/page to capture, generate capture id and save to session
				deleteCookie("captureid");
				deleteCookie("replayid");
				var id = nativeDate.now();
				console.log("# Start capturing log with id: " + id);
				setCookie('captureid',id);
				sessionStorage[capture_session_token] = id;
				sessionStorage[capture_session_token + '_seq'] = 0;
			}

			var id = sessionStorage[capture_session_token];
			var seq = sessionStorage[capture_session_token + '_seq'];

			// Save logs to database for further replay
			nativeSetInterval.call(window, function() {
				var xhr = new nativeXMLHttpRequest();
				var duration = nativeDate.now() - id;
				var obj = {logId: id, 
						   sequence: seq,
						   codeVersion: codeVersion, 
						   exception: withException,
						   duration: duration,
						   log: JSON.stringify(Reanimator.flush())};
				var string = JSON.stringify(obj);
				xhr.open('POST', updateUrl, true);
				xhr.setRequestHeader("Content-Type", "application/json;charset=utf-8");
				xhr.send(string);

			}, 500);

            /*nativeSetInterval.call(window, function() {
                // Save captured log to local storage every 0.5 seconds
                localStorage['reanimator-' + id] = JSON.stringify(Reanimator.flush());

            }, 500);*/

		}
		
		Reanimator.capture(isTopWindow);
	}
}());
