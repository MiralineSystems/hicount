var
	path = require("path"),
	fs = require("fs"),
	mmap = require("mmap"),
	schedule = require('node-schedule')

var fds = {};
//var bufs = {}
var cache = {};

exports.cfg = {
	SLOT_SECONDS: 1,
	SLOTS_PER_FILE: 86400 / 1,     //  / SLOT_SECONDS,
	SLOT_CELLS: 2,
	CELL_BYTES: 2,
	DB_DIR: './var/db/',
	DB_EXT: '.db',
	GMT: 3,
}

exports.CELL_HIT = 0;
exports.CELL_IP = 1;

function initFile(file) {
	var emptyBuf = new Buffer(exports.cfg.SLOTS_PER_FILE * exports.cfg.CELL_BYTES * exports.cfg.SLOT_CELLS);
	emptyBuf.fill(0);
	var dir = path.dirname(file);
	if (! fs.existsSync(dir)) fs.mkdirSync(dir);
	fs.writeFileSync(file, emptyBuf);
	console.log('initFile: '+file);
}

function openFile(site, day_tm, isWriting) {
	var fd = false;
	var key = getKey(site, day_tm);
	if (key in fds) {
		fd = fds[key];
	} else {
		var file = getFile(site, day_tm);
		try {
			if (isWriting && !fs.existsSync(file)) initFile(file);
			fd = fs.openSync(file, 'r+');
		} catch(e) {if (isWriting) console.log('db.openFile('+(isWriting ? 'write' : 'read')+'): '+file+': '+e);}
		if (fd) fds[key] = fd;
	}
	return fd;
}

function closeFile(site, day_tm) {
//	var key = getKey(sites, day_tm);
//	fs.closeSync(fds[key]);
}

function getKey(site, day_tm) {
	return site + day_tm; // TODO: dangerous when number of sites is >86400 (or 3600 if not on GMT0 day boundary)
}

function getFile(site, day_tm) {
	return exports.cfg.DB_DIR + site + '/' + day_tm + exports.cfg.DB_EXT;
}

function getDayBegin(tm) {
	var day_tmSec = exports.cfg.SLOTS_PER_FILE * exports.cfg.SLOT_SECONDS;
	return tm - tm % day_tmSec;
}

function fixTm(tm) {
	return tm + exports.cfg.GMT*3600;
	//return tm;
}

function preCache(site, day_tm) {
	var fd = openFile(site, day_tm, false);

	if (!cache[site]) cache[site] = {};
	if (!cache[site][day_tm]) cache[site][day_tm] = {};

	try { 
		var buf = new Buffer(exports.cfg.SLOTS_PER_FILE * exports.cfg.CELL_BYTES * exports.cfg.SLOT_CELLS);
		buf.fill(0);
		var bytes = fd ? fs.readSync(fd, buf, 0, buf.length, 0) : 0;
		var i, slot, cell, tm;

		for (tm=day_tm, slot=0; tm<day_tm+exports.cfg.SLOTS_PER_FILE*exports.cfg.SLOT_SECONDS; tm += exports.cfg.SLOT_SECONDS, slot++) {
			for (cell=0; cell<exports.cfg.SLOT_CELLS; cell++) {
				if (! cache[site][day_tm][cell]) cache[site][day_tm][cell] = {};
				if (! cache[site][day_tm][cell][tm]) cache[site][day_tm][cell][tm] = 0;
				if ((slot+1) * exports.cfg.SLOT_CELLS * exports.cfg.CELL_BYTES - 1 < buf.length) {
					for (i=0; i<exports.cfg.CELL_BYTES; i++) {
						cache[site][day_tm][cell][tm] += buf.readUInt8(slot * exports.cfg.SLOT_CELLS * exports.cfg.CELL_BYTES + cell * exports.cfg.CELL_BYTES + i) << i*8;
					}
				}
			}
		}

		console.log('db.preCache: precached file '+getFile(site, day_tm)+': '+bytes+' bytes');
	} catch (e) {console.log('preCache error: '+e);}
	
	if (fd) closeFile(site, day_tm);	
}

exports.set = function(site, tm, cell, val) {
	tm = fixTm(tm);
	var day_tm = getDayBegin(tm);

	var fd = openFile(site, day_tm, true);
	if (! fd) { console.log('db.set: error opening file '+getFile(site, day_tm)); return false; }

	var buf = new Buffer(exports.cfg.CELL_BYTES);
	for (var i=0; i<exports.cfg.CELL_BYTES; i++) buf.writeUInt8(val >> i*8 & 0xff, i);
	var slot = Math.floor((tm - day_tm) / exports.cfg.SLOT_SECONDS);

	try {
		fs.writeSync(fd, buf, 0, exports.cfg.CELL_BYTES, slot * exports.cfg.SLOT_CELLS * exports.cfg.CELL_BYTES + cell * exports.cfg.CELL_BYTES);
	} catch (e) {console.log('db.set: error writing to file '+getFile(site, day_tm)+': '+e);}

	closeFile(site, day_tm);

	if (!cache[site] || !cache[site][day_tm] || !cache[site][day_tm][cell]) preCache(site, day_tm);
	cache[site][day_tm][cell][tm] = val;

	return val;
}

exports.get = function(site, tm, cell) {
	tm = fixTm(tm);
	var day_tm = getDayBegin(tm);
	if (!cache[site] || !cache[site][day_tm] || !cache[site][day_tm][cell]) preCache(site, day_tm);
	return cache[site][day_tm][cell][tm];
}

