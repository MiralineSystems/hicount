var	schedule = require('node-schedule')
	, jf = require('jsonfile')
	, fs = require('fs');

var STORAGE_DIR = './var/db/';

var files = [];

exports.init = function(name, def) {
	var fn = STORAGE_DIR + name + '.json';

	if (fs.existsSync(fn)) {
		try {
			global[name] = JSON.parse(fs.readFileSync(fn));
			//global[name] = jf.readFileSync(fn);
			files.push(name);
			console.log('Storage '+name+' loaded');
		} catch(e) {console.log('Storage '+name+' load failed: '+e);};
	} else {
		global[name] = def;
		console.log('Storage '+name+' inited')
		files.push(name);
	}
}

function flush(table) {
	for (var i=0; i<files.length; i++) {
		var name = files[i];
		if (table && table!=name) continue;
		console.log('Flushing to disk: '+name);
		var fn = STORAGE_DIR + name + '.json';
		//jf.writeFileSync(fn, global[name]);
		fs.writeFileSync(fn, JSON.stringify(global[name]));
	}
}
exports.flush = flush;

process.on('exit', flush).on('SIGINT', flush).on('SIGTERM', function(){process.exit(0);});

var minCron = schedule.scheduleJob('* * * * *', function(){ flush(); });
