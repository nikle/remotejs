/**
 * Dashboard JavaScript to show all recordings and replay records
 */

var host = 'localhost';
var port = '8889';

var app = angular.module('myApp', ['ngGrid']);
// Controller for code versions control
app.controller('DebugCtrl', function($scope, $http) {
	 $scope.getDebugLog = function(){
	    	var url = "http://" + host + ":" + port + "/getLogs?id=" + $scope.logid;
            var result = "";
	    	$http.get(url).success(function(data){
                for(var i= 0; i<data.length; ++i){
                    var temp = data[i].log;
                    var log = JSON.parse(temp);
                    var seq = data[i].sequence;
                    //console.log(JSON.stringify(log,null,"\t"));
                    result += "Sequence id is " +seq+ "\n" + JSON.stringify(log,null,"\t");
                    //	console.log(data.length);
                    //var log = JSON.parse(JSON.parse(data[i]));
                    //result+= JSON.stringify(log,null,"\t");
                    //console.log("response is " +result);
                }

                $scope.logResult =result;
	    	});
	    };
    
});
