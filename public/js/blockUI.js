(function() {
	var query = location.search;
	var REPLAY_TOKEN = '?replay=';

	if (query.indexOf(REPLAY_TOKEN) >= 0) {
		$(document).ready(function() {
			$("body").append('<div style="z-index: 1000; border: none; margin: 0px; padding: 0px; width: 100%; height: 100%; top: 0px; left: 0px; background-color: rgb(0, 0, 0); opacity: 0; cursor: wait; position: fixed;"></div><div style="z-index: 1011; position: fixed; padding: 15px; margin: 0px; width: 30%; top: 40%; left: 35%; text-align: center; color: rgb(255, 255, 255); border: none; background-color: rgb(0, 0, 0); cursor: wait; border-top-left-radius: 10px; border-top-right-radius: 10px; border-bottom-right-radius: 10px; border-bottom-left-radius: 10px; opacity: 0.5;"><h1>We are replaying your execution!!!</h1><h1>No user input is allowed during the replay</h1></div>');
		});
	}
}());
