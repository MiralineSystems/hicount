var WebSocketServer = require('ws').Server
	, extend = require('extend')
	, my = require('./my')
	, db = require('./db')
	, user = require('./user')
	, schedule = require('node-schedule')
;

// WebSockets
var wss = new WebSocketServer({server: global.server});
var polls = {};
var granularities = [1,2,3,5,10,20,30,60,120,180,300,600,1800,3600,7200];
var refreshes = [0.1, 0.25, 0.33, 0.5, 1, 2, 5, 10, 30, 60];
var prevs = [1, 7, 28];
var lastConnID = 1;

wss.on('connection', function(ws) {
	var intervalID, connID = lastConnID++;
	var poll = {nReq: 0, curDaysAgo: 0, prevDaysAgo: 1, fullData: 1, refresh: 0.5, stat: {}};
	var sess, sessionID, lastRes;

	global.cookieParser(ws.upgradeReq, null, function(err) {
		sessionID = ws.upgradeReq.signedCookies['sid'];
		console.log('sessionID: '+sessionID);
		global.store.get(sessionID, function(err, session) {
			if (session) {
				sess = session;
			} else console.log('No session, err='+err);
		});
	}); 

	ws.on('message', function(msg) {
		console.log('received: '); console.log(msg);
		msg = JSON.parse(msg);
		//console.log('session:'); console.log(sess);

		if (sess && sess.auth && sess.auth.loggedIn) poll.userID = sess.auth.userId;
		if (! poll.userID) {
			console.log('Not authenticated! Sess=');
			console.log(sess);
			ws.send(JSON.stringify({error: 'NOT_AUTHED'}), function() {  });
			return;
		}
	
		// Init from user prefs
		var prefList = ['prevDaysAgo', 'refresh', 'siteID'];
		for (var pref in prefList) {
			pref = prefList[pref];
			var val = user.getUserPref(poll.userID, pref);
			if (val!==false) poll[pref] = val;
		}

		if ('siteID' in msg) {
			var sid = parseInt(msg.siteID);
			if (sid in user.sitesByUser(poll.userID)) {
				poll.siteID = sid;
				user.setUserPref(poll.userID, 'siteID', poll.siteID);
			} else {
				console.log('Site '+sid+' is not allowed for user '+poll.userID);
				ws.send(JSON.stringify({error: 'NO_ACCESS'}), function() {  });
				return;
			}
		}

		if (! poll.siteID && Object.keys(user.sitesByUser(poll.userID)).length>0) {
			poll.siteID = Object.keys(user.sitesByUser(poll.userID))[0];
			user.setUserPref(poll.userID, 'siteID', poll.siteID);
		}
		console.log('siteID: '+poll.siteID);

		if ('curDaysAgo' in msg) poll.curDaysAgo = msg.curDaysAgo;
		if ('prevDaysAgo' in msg) {
			poll.prevDaysAgo = msg.prevDaysAgo;
			user.setUserPref(poll.userID, 'prevDaysAgo', poll.prevDaysAgo);
		}
		if (msg.fullData>0) poll.fullData = msg.fullData;
		if ('granularity' in msg) poll.granularity = msg.granularity;
		if (msg.refresh>0) {
			poll.refresh = msg.refresh;
			user.setUserPref(poll.userID, 'refresh', poll.refresh);
		}
		console.log(poll);

		if (intervalID) {
			delete polls[connID];
			clearInterval(intervalID);
		}

		intervalID = setInterval(function() {
			if (typeof(polls[connID])=='undefined') polls[connID] = poll;
			poll = polls[connID];

			var data = [], res = {};
			var t, tm, tg, list, val;
			var tBegin, tEnd, v1, v2, v3, v4;
			var curShift = - 86400 * poll.curDaysAgo;
			var prevShift = - 86400 * poll.prevDaysAgo;
			var dayBegin = my.dayBeginDate() + curShift;
			var dayEnd = dayBegin + 86400;
			var tmNow = Math.floor(new Date()/1000);
			var hrStart = process.hrtime();
			var inc = db.cfg.SLOT_SECONDS;

			function calcGranularity(callback) {
				if (!poll.granularity) {
					console.log('granular: begin: '+my.fmtTm(dayBegin)+' end: '+my.fmtTm(dayEnd));
					var sumHits = 0, cntHits=0;
					var skip = 10;
					var tres = 0.5;
					var tEnd = Math.min(dayEnd, tmNow+curShift);
					for (tm=dayBegin; tm < tEnd; tm += inc * skip) {
						val = db.get(poll.siteID, tm, db.CELL_HIT);
						/*if (val>0)*/ { sumHits += val; cntHits++; }
					}
					var avg = cntHits>0 ? sumHits / cntHits / skip : 0;
					for (var i in granularities) if (avg * granularities[i] > tres) {poll.granularity = granularities[i]; break;}
					if (! poll.granularity) poll.granularity = granularities[granularities.length-1];
					console.log('avg='+avg);
					console.log('granularity='+poll.granularity);
				}
				process.nextTick(callback);
			}

			function countMain(tBegin, tEnd, callback) {
				for (t=tBegin; t<tEnd; t += inc) {
					if (t - tBegin >= 1000) break;

					tg = t - t % poll.granularity;

					if (t <= tmNow) {
						v1 = db.get(poll.siteID, t, db.CELL_HIT);
						v3 = db.get(poll.siteID, t, db.CELL_IP);
					} else {v1 = 0; v3 = 0;}

					v2 = db.get(poll.siteID, t + prevShift, db.CELL_HIT);
					v4 = db.get(poll.siteID, t + prevShift, db.CELL_IP);

					if (data.length>0 && data[data.length-1][0]==tg) {
						data[data.length-1][1] += v1;
						data[data.length-1][2] += v2;
						data[data.length-1][3] += v3;
						data[data.length-1][4] += v4;
					} else data.push([tg, v1, v2, v3, v4]);
				}
				if (t<tEnd) process.nextTick(function(){ countMain(t, tEnd, callback); });
				else process.nextTick(callback);
			}

			function countChange(tBegin, tEnd, callback) {
				for (t=tBegin; t<tEnd; t += inc) {
					if (t - tBegin >= 1000) break;

					poll.stat.hitsCurDay += db.get(poll.siteID, t, db.CELL_HIT);
					poll.stat.hitsPrevDay += db.get(poll.siteID, t + prevShift, db.CELL_HIT);
					poll.stat.ipsCurDay += db.get(poll.siteID, t, db.CELL_IP);
					poll.stat.ipsPrevDay += db.get(poll.siteID, t + prevShift, db.CELL_IP);

					if (t>=tEnd - 3600) {
						poll.stat.hitsCurHour += db.get(poll.siteID, t, db.CELL_HIT);
						poll.stat.hitsPrevHour += db.get(poll.siteID, t + prevShift, db.CELL_HIT);
						poll.stat.ipsCurHour += db.get(poll.siteID, t, db.CELL_IP);
						poll.stat.ipsPrevHour += db.get(poll.siteID, t + prevShift, db.CELL_IP);
					}
				}
				if (t<tEnd) process.nextTick(function(){ countChange(t, tEnd, callback); });
				else process.nextTick(callback);
			}

			function countUsual(tBegin, tEnd, callback) {
				for (t=tBegin; t<=tEnd; t += inc) {
					tg = t - t % poll.granularity;
					list = [
						db.get(poll.siteID, t, db.CELL_HIT),
						0,
						db.get(poll.siteID, t, db.CELL_IP),
						0,
					];

					if (data.length>0 && data[data.length-1][0]==tg) {
						for (var i=0; i<list.length; i++) data[data.length-1][i+1] += list[i];
					} else { list.unshift(tg); data.push(list); }
				}
				//if (t<tEnd) countUsual(t, tEnd, callback);
				//else callback();
				if (t<tEnd) process.nextTick(function(){ countUsual(t, tEnd, callback); });
				else process.nextTick(callback);
			}

			function sendResponse() {
				res = {
					//memuse: process.memoryUsage(),
					data: data,
					poll: poll,
					info: {},
				};
				if (poll.fullData) {
					res.sites = user.listSitesByUser(poll.userID);
					res.granularities = granularities;
					res.refreshes = refreshes;
					res.prevs = prevs;
					res.info.isSiteOwner = user.isSiteOwner(poll.userID, poll.siteID);
				}

				var datestr = new Date().toString().substring(4);
				datestr = datestr.substring(0, datestr.indexOf('00 ('));
				res.info = extend(null, null, res.info, {
					timestamp: Math.floor(new Date()/1000),
					realTimestamp: new Date()/1,
					datestr: datestr,
				});
				//console.log('poll: '); console.log(poll);
				lastRes = res;
				ws.send(JSON.stringify(res), function() {  });
				//if (! poll.fullData) {console.log('sent data: '); console.log(res.data);}

				poll.nReq++;
				poll.fullData = 0;
				polls[connID] = poll;
			}

			if (poll.fullData) {
				calcGranularity(function(){
					console.log('fullData1: begin: '+my.fmtTm(dayBegin)+' end: '+my.fmtTm(dayEnd));
					countMain(dayBegin, dayEnd, function(){
						tBegin = tmNow + curShift - 86400;
						tEnd = tmNow + curShift;
						console.log('fullData2: begin: '+my.fmtTm(tBegin)+' end: '+my.fmtTm(tEnd));

						poll.stat = {
							hitsCurDay: 0,
							hitsCurHour: 0,
							ipsCurDay: 0,
							ipsCurHour: 0,
							hitsPrevDay: 0,
							hitsPrevHour: 0,
							ipsPrevDay: 0,
							ipsPrevHour: 0,
						}
						countChange(tBegin, tEnd, function(){
							console.log(sessionID+' fullData took '+my.took(hrStart)+' ms');
							sendResponse();
						});
					});
				});

			} else {
				tBegin = Math.floor((tmNow+curShift) / poll.granularity / db.cfg.SLOT_SECONDS - 1) * poll.granularity * db.cfg.SLOT_SECONDS;
				tEnd = tmNow+curShift;
				//console.log('usual: begin: '+my.fmtTm(tBegin)+' end: '+my.fmtTm(tEnd));
				countUsual(tBegin, tEnd, function(){
					//console.log(sessionID+' usual took '+my.took(hrStart)+' ms');
					if (! lastRes || Math.floor(lastRes.info.timestamp / db.cfg.SLOT_SECONDS) != Math.floor(tmNow / db.cfg.SLOT_SECONDS)) { // new slot
						poll.stat.hitsCurDay += db.get(poll.siteID, tmNow+curShift-db.cfg.SLOT_SECONDS, db.CELL_HIT) - db.get(poll.siteID, tmNow+curShift-86400-db.cfg.SLOT_SECONDS, db.CELL_HIT);
						poll.stat.hitsCurHour += db.get(poll.siteID, tmNow+curShift-db.cfg.SLOT_SECONDS, db.CELL_HIT) - db.get(poll.siteID, tmNow+curShift-3600-db.cfg.SLOT_SECONDS, db.CELL_HIT);
						poll.stat.ipsCurDay += db.get(poll.siteID, tmNow+curShift-db.cfg.SLOT_SECONDS, db.CELL_IP) - db.get(poll.siteID, tmNow+curShift-86400-db.cfg.SLOT_SECONDS, db.CELL_IP);
						poll.stat.ipsCurHour += db.get(poll.siteID, tmNow+curShift-db.cfg.SLOT_SECONDS, db.CELL_IP) - db.get(poll.siteID, tmNow+curShift-3600-db.cfg.SLOT_SECONDS, db.CELL_IP);
						poll.stat.hitsPrevDay += db.get(poll.siteID, tmNow+curShift-db.cfg.SLOT_SECONDS+prevShift, db.CELL_HIT) - db.get(poll.siteID, tmNow+curShift-86400-db.cfg.SLOT_SECONDS+prevShift, db.CELL_HIT);
						poll.stat.hitsPrevHour += db.get(poll.siteID, tmNow+curShift-db.cfg.SLOT_SECONDS+prevShift, db.CELL_HIT) - db.get(poll.siteID, tmNow+curShift-3600-db.cfg.SLOT_SECONDS+prevShift, db.CELL_HIT);
						poll.stat.ipsPrevDay += db.get(poll.siteID, tmNow+curShift-db.cfg.SLOT_SECONDS+prevShift, db.CELL_IP) - db.get(poll.siteID, tmNow+curShift-86400-db.cfg.SLOT_SECONDS+prevShift, db.CELL_IP);
						poll.stat.ipsPrevHour += db.get(poll.siteID, tmNow+curShift-db.cfg.SLOT_SECONDS+prevShift, db.CELL_IP) - db.get(poll.siteID, tmNow+curShift-3600-db.cfg.SLOT_SECONDS+prevShift, db.CELL_IP);
					}
					sendResponse();
				});
			}
		}, poll.refresh * 1000);
		console.log('(re)started client interval '+(poll.refresh * 1000));
	});

	ws.on('close', function() {
		console.log('stopping client interval');
		delete polls[connID];
		clearInterval(intervalID);
	})

	console.log('started client connection');
});

// Crontab
var dayCron = schedule.scheduleJob('0 0 * * *', function(){
	console.log("Daily cron");
	//global.ips.clear();
	for (var id in polls) polls[id].fullData = 1;
});

