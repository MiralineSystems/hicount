var util = require('util');

exports.dayBeginDate = function() {
	var now = new Date();
	var dayBegin = Math.floor(now/1000) - now.getHours()*3600 - now.getMinutes()*60 - now.getSeconds();
	return dayBegin;
}

Number.prototype.pad = function(size) {
	var s = String(this);
	if(typeof(size) !== "number"){size = 2;}
	while (s.length < size) {s = "0" + s;}
	return s;
}


exports.fmtTm = function (tm) {
	return new Date(tm*1000).toString();
}

exports.took = function (start) {
	var diff = process.hrtime();
	return ((diff[0] - start[0]) * 1e9 + (diff[1] - start[1])) / 1000000;
}

