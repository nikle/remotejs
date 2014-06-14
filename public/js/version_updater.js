/**
 * Dashboard JavaScript to show all recordings and replay records
 */

var host = 'localhost';
var port = '8889';

var app = angular.module('myApp', ['ngGrid']);
// Controller for code versions control
app.controller('VersionCtrl', function($scope, $http) {
	// Controller for displaying complete code versions list
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
    	var getAllRecordingsURL = "http://" + host + ":" + port + "/getCompleteCodeVersions";
    	
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
	
    $scope.gridOptions_versions = {
        data: 'myData',
        enablePaging: true,
        showFooter: true,
        enableColumnResize: true,
        enableHighlighting: true,
        enableCellSelection: true,        
        enableCellEditOnFocus: true,
        maxWidth: 600,
        totalServerItems:'totalServerItems',
        pagingOptions: $scope.pagingOptions,
        filterOptions: $scope.filterOptions,
        selectedItems : []
    };
    
    $scope.updateCodeVersion = function(){
    	var version = $scope.version;
    	var url = "http://" + host + ":" + port + "/updateCodeVersion";
    	$http({
    		url: url,
    		method: "GET",
    		params: {version: version, url: $scope.url}
    	});
    	
    	$scope.getPagedDataAsync($scope.pagingOptions.pageSize, $scope.pagingOptions.currentPage);
    		
    	
    	
    };
    
});
