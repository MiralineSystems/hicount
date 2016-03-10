var
	url = require('url'),
	ip = require('ip'),
	user = require('./lib/user'),
	db = require('./lib/db');

exports.index = function (req, res) {
	if (req.loggedIn) {
		var userID = parseInt(req.user.id);
		if (Object.keys(user.sitesByUser(userID)).length==0) {
			res.redirect('welcome');
		} else {
			res.render('stat');
		}
	} else {
		res.render('home');
	}
}

exports.welcome = function(req, res) {
	if (! req.loggedIn) {res.redirect('/'); return;}
	res.render('welcome');
}

exports.welcome_post = function(req, res) {
	if (! req.loggedIn) {res.redirect('/'); return;}
	var name = req.body.name.trim();
	if (name.length<3) { res.render('welcome', {name: name, error: 'Please enter correct website name'}); return;}

	var userID = parseInt(req.user.id);
	user.addSite(userID, name);
	res.redirect('/');
}

exports.users = function(req, res) {
	var params = url.parse(req.url, true);
	var ret = {};
	var userID = parseInt(req.user.id);
	var siteID = parseInt(req.body.siteID);
	console.log('users: action='+req.params.action); console.log('userID='+userID); console.log('siteID='+siteID);

	if (! user.isUser(userID)) {
		ret.error = "No User";
	} else if (! user.isSite(siteID)) {
		ret.error = "No Site";
	} else if (! user.isSiteOwner(userID, siteID)) {
		ret.error = "Not owner";
	} switch (req.params.action) {
		case 'list': 
			ret.users = user.getSiteUsers(siteID);
			break;
		case 'add':
			var toUserID = user.findUserByEmail(req.body.email);
			var isOwner = req.body.isOwner=='true';
			if (user.getSiteAccess(toUserID, siteID)===isOwner) ret.error = 'User #'+toUserID+' already has access';
			else user.grantSite(toUserID, siteID, isOwner);
			break;
		case 'del':
			var toUserID = req.body.toUserID;
			var owners = user.listOwnersBySite(siteID);
			if (!user.hasSiteAccess(toUserID, siteID)) ret.error = 'User #'+toUserID+' does not have access to site #'+siteID;
			else if (owners.length==1 && owners.indexOf(toUserID)>=0) ret.error = 'At least one user should own a website';
			else user.revokeSite(toUserID, siteID);
			break;
		default:
			ret.error = 'Unknown action: '+req.params.action;
	}
	
	res.json(ret);
}

exports.sites = function(req, res) {
	var params = url.parse(req.url, true);
	var ret = {};
	var userID = parseInt(req.user.id);
	var siteID = parseInt(req.body.siteID);
	console.log('sites: action='+req.params.action); console.log('userID='+userID); console.log('siteID='+siteID);

	if (! user.isUser(userID)) {
		ret.error = "No User";
	} else if (siteID && ! user.isSite(siteID)) {
		ret.error = "Invalid Site";
	} else if (siteID && ! user.isSiteOwner(userID, siteID)) {
		ret.error = "Not owner";
	} else switch (req.params.action) {
		case 'list': 
			ret.sites = user.listSitesOwnedByUser(userID);
			break;
		case 'add':
			user.addSite(userID, req.body.name);
			break;
		case 'edit':
			user.editSite(siteID, req.body.name);
			break;
		case 'del':
			user.delSite(siteID);
			break;
		default:
			ret.error = 'Unknown action: '+req.params.action;
	}
	
	res.json(ret);
}

exports.test = function(req, res){
	console.log(req.session);
	res.writeHead(200, {"Content-Type": "text/plain"});
	res.write("TEST_OK\n");
	res.end();
}

exports.hit = function(req, res){
//	var st = new Date();
	var params = url.parse(req.url, true);
	var siteID = parseInt(params.query.id, 10);
	var hits = 0, ips = 0;
	req_ip = req.header('x-forwarded-for').split(/[, ;]+/);
	req_ip = (req_ip.length > 0 ? req_ip = req_ip[req_ip.length-1] : null);
	if (! req_ip || req_ip=='unknown') req_ip = req.connection.remoteAddress;

	//console.log(req_ip+': 0: %dms', (new Date()-st));
	if (user.isSite(siteID)) {

		var tm = Math.floor(new Date()/1000);
		hits = db.get(siteID, tm, db.CELL_HIT); hits++; db.set(siteID, tm, db.CELL_HIT, hits);

		try {
			var ipKey = 'ip.' + siteID + "." + ip.toLong(req_ip);

			global.redisClient.get(ipKey, function(err, reply){

				if (! reply) {
					global.redisClient.set(ipKey, 1, function(){
						global.redisClient.expireat(ipKey, parseInt((+new Date)/1000) + 86400);
					});
					ips = db.get(siteID, tm, db.CELL_IP); ips++; db.set(siteID, tm, db.CELL_IP, ips);
				}
			});
		} catch(e) {console.log('IP error: %s', e);}
	
	}
	//res.writeHead(200, {"Content-Type": "text/plain"});
	//res.write("OK\n" + hits.toString() + "\n");
	res.writeHead(200, {"Content-Type": "image/gif"});
	res.write("\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b", 'binary');
	res.end();
};

