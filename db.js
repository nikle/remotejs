/**
 * Mongo DB module connecting to remotedebugging database
 */
var host = "localhost";
var databaseURI = host + ":27017/remotedebugging";
var collections = ["recordings", "codeVersions", "replayHistory", "regression_test"];
var db = require("mongojs").connect(databaseURI, collections);

module.exports = db;