/**
 * Dashboard JavaScript to show all recordings and replay records
 */

var host = 'localhost';
var port = '8889';
var app = angular.module('myApp', ['ngGrid'], function($locationProvider) {
    $locationProvider.html5Mode(true);
});
// Controller for recordings
app.controller('RecordingCtrl', function($scope, $http, $location) {
	$scope.logId = $location.search()['logid'];
	// Controller for displaying complete recordings list
    $scope.filterOptions = {
        filterText: "",
        useExternalFilter: true
    };
    $scope.totalServerItems = 0;
    $scope.pagingOptions = {
        pageSizes: [5],
        pageSize: 5,
        currentPage: 1
    };  
    $scope.setPagingData = function(data, page, pageSize){	
        var pagedData = data.slice((page - 1) * pageSize, page * pageSize);
        $scope.myData = pagedData;
        $scope.totalServerItems = data.length;
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };
    $scope.getPagedDataAsync = function (pageSize, page, searchText) {
    	var getAllRecordingsURL = "http://" + host + ":" + port + "/getAllRecordings";
    	if($scope.logId !== undefined){
    		getAllRecordingsURL = getAllRecordingsURL + "?logid=" + $scope.logId;
    	}
    	
        setTimeout(function () {
            $http.get(getAllRecordingsURL).success(function(data){
            	$scope.setPagingData(data,page,pageSize);
            });
        }, 100);
    };
	
    $scope.getPagedDataAsync($scope.pagingOptions.pageSize, $scope.pagingOptions.currentPage);
	
    $scope.$watch('pagingOptions', function (newVal, oldVal) {
        if (newVal !== oldVal && newVal.currentPage !== oldVal.currentPage) {
          $scope.getPagedDataAsync($scope.pagingOptions.pageSize, $scope.pagingOptions.currentPage, $scope.filterOptions.filterText);
        }
    }, true);
    $scope.$watch('filterOptions', function (newVal, oldVal) {
        if (newVal !== oldVal) {
          $scope.getPagedDataAsync($scope.pagingOptions.pageSize, $scope.pagingOptions.currentPage, $scope.filterOptions.filterText);
        }
    }, true);
	
    $scope.gridOptions_recording = {
        data: 'myData',
        enablePaging: true,
        showFooter: true,
        enableColumnResize: true,
        enableHighlighting: true,
        totalServerItems:'totalServerItems',
        pagingOptions: $scope.pagingOptions,
        filterOptions: $scope.filterOptions,
        selectedItems : []
    };
    
    
    // Controller for code version list and to replay button
    $scope.codeVersions = [];
    $scope.codeVersion = '';
    $scope.getCodeVersions = function(){
    	var url = "http://" + host + ":" + port + "/getCodeVersions";
    	$http.get(url).success(function(data){
    		$scope.codeVersions = data;
    		$scope.codeVersion = $scope.codeVersions[0];
    	});
    };
    $scope.getCodeVersions();
    
    // Controller for target machine list
    $scope.targetMachines = [];
    $scope.targetMachine = '';
    $scope.getTargetMachines = function(){
    	var url = "http://" + host + ":" + port + "/getTargetMachines";
    	$http.get(url).success(function(data){
    		$scope.targetMachines = data;
    		$scope.targetMachine = $scope.targetMachines[0];
    	});
    }
    $scope.getTargetMachines();

    // Add selected recordings to "to-replay" list
    $scope.toReplay = function(){
    	var targetVersion = $scope.codeVersion;
    	var targetMachine = $scope.targetMachine;
    	var selected = $scope.gridOptions_recording.selectedItems;
    	var url = "http://" + host + ":" + port + "/toReplay";
    	$http({
    		url: url,
    		method: "GET",
    		params: {version: targetVersion, machine: targetMachine, recordings: selected}
    	});
    	
    	
    };
});


// Controller for replay
app.controller('ReplayCtrl', function($scope, $http) {
	 $scope.filterOptions = {
		        filterText: "",
		        useExternalFilter: true
		    };
		    $scope.totalServerItems = 0;
		    $scope.pagingOptions = {
		        pageSizes: [5],
		        pageSize: 5,
		        currentPage: 1
		    };  
		    $scope.setPagingData = function(data, page, pageSize){	
		        var pagedData = data.slice((page - 1) * pageSize, page * pageSize);
		        $scope.myData = pagedData;
		        $scope.totalServerItems = data.length;
		        if (!$scope.$$phase) {
		            $scope.$apply();
		        }
		    };
		    $scope.getPagedDataAsync = function (pageSize, page, searchText) {
		    	var getAllRecordingsURL = "http://" + host + ":" + port + "/getReplayHistory";
		    	
		        setTimeout(function () {
		            $http.get(getAllRecordingsURL).success(function(data){
		            	$scope.setPagingData(data,page,pageSize);
		            });
		        }, 100);
		    };
			
		    $scope.getPagedDataAsync($scope.pagingOptions.pageSize, $scope.pagingOptions.currentPage);
			
		    $scope.$watch('pagingOptions', function (newVal, oldVal) {
		        if (newVal !== oldVal && newVal.currentPage !== oldVal.currentPage) {
		          $scope.getPagedDataAsync($scope.pagingOptions.pageSize, $scope.pagingOptions.currentPage, $scope.filterOptions.filterText);
		        }
		    }, true);
		    $scope.$watch('filterOptions', function (newVal, oldVal) {
		        if (newVal !== oldVal) {
		          $scope.getPagedDataAsync($scope.pagingOptions.pageSize, $scope.pagingOptions.currentPage, $scope.filterOptions.filterText);
		        }
		    }, true);
			
		    $scope.gridOptions_replay = {
		        data: 'myData',
		        enablePaging: true,
		        showFooter: true,
		        enableColumnResize: true,
		        enableHighlighting: true,
		        totalServerItems:'totalServerItems',
		        pagingOptions: $scope.pagingOptions,
		        filterOptions: $scope.filterOptions,
		        selectedItems : []
		    };
});
