var
	extend = require('extend'),
	storage = require('./storage')
;

exports.newUser = function(source, sourceUser) {
	var user;
	/*if (arguments.length === 1) { // password-based
		user = sourceUser = source;
		user.id = ++global.users.nextUserId;
		return global.users.usersById[global.users.nextUserId] = user;
	} else { // non-password-based*/
	var userID = global.users.nextUserId++;
	user = global.users.usersById[userID] = {
		id: userID,
		sites: {}
	};
	if (userID==1) user.sites = {'1': true, '2': true, '3': true, '4': true};
	else user.sites = {'9': false};
	user[source] = sourceUser;
	////storage.flush();
	//}
	return user;
}

exports.findOrCreateUser = function (sess, accessToken, extra, googleUser) {
	googleUser.refreshToken = extra.refresh_token;
	googleUser.expiresIn = extra.expires_in;

	var user = exports.findUserByGoogleId(googleUser.id) || exports.newUser('google', googleUser);
	user.googleUser = googleUser;
	console.log('user auth id: ' + user.googleUser.id);
	return user;

/*
	var promise = this.Promise();
	var user = exports.findUserByGoogleId(googleUser.id) || exports.newUser('google', googleUser);
	promise.fulfill(user); 
	return promise;
*/
}

exports.findUserByGoogleId = function(googleId) {
	for (var userID in global.users.usersById) if (googleId==global.users.usersById[userID].google.id) return global.users.usersById[userID];
	return false;
}

exports.findUserByEmail = function(email) {
	email = email.trim();
	if (email.length<5 || email.indexOf('@')<0) return false;
	for (userID in global.users.usersById) if (email==global.users.usersById[userID].google.email) return userID;
	return false;
}

exports.sitesByUser = function(userID) {
	if (! global.users.usersById[userID]) return false;
	return global.users.usersById[userID].sites;
}

exports.listSitesByUser = function(userID) {
	if (! global.users.usersById[userID]) return false;
	var sites = global.users.usersById[userID].sites;
	var res = [];
	for (var siteID in sites) res.push(extend(null, null, global.sites.sitesById[siteID], {isOwner: sites[siteID]}));
	return res;
}

exports.listSitesOwnedByUser = function(userID) {
	if (! global.users.usersById[userID]) return false;
	var sites = global.users.usersById[userID].sites;
	var res = [];
	for (var siteID in sites) if (sites[siteID]===true) res.push(extend(null, null, global.sites.sitesById[siteID], {isOwner: sites[siteID]}));
	return res;
}

exports.listOwnersBySite = function(siteID) {
	var users = [];
	for (var userID in global.users.usersById) if (siteID in global.users.usersById[userID].sites && global.users.usersById[userID].sites[siteID]===true) users.push(userID);
	return users;
}

exports.isUser = function(userID) {
	return (userID in global.users.usersById);
}

exports.getUser = function(userID) {
	return global.users.usersById[userID];
}

exports.setUserPref = function(userID, pref, val) {
	var user = exports.getUser(userID);
	if (! user) return false;
	if (! user.prefs) user.prefs = {};
	user.prefs[pref] = val;
	return true;
}

exports.getUserPref = function(userID, pref) {
	var user = exports.getUser(userID);
	if (!user || !user.prefs || user.prefs[pref]===undefined) return false;
	return user.prefs[pref];
}

exports.isSiteOwner = function(userID, siteID) {
	return (global.users.usersById[userID].sites[siteID]===true);
}

exports.getSiteAccess = function(userID, siteID) {
	return (global.users.usersById[userID].sites[siteID]);
}

exports.hasSiteAccess = function(userID, siteID) {
	return siteID in global.users.usersById[userID].sites;
}

exports.getSiteUsers = function(siteID) {
	var res = [];
	for (var userID in global.users.usersById) 
		if (siteID in global.users.usersById[userID].sites)
			res.push({
				id: userID,
				email: global.users.usersById[userID].google.email,
				name: global.users.usersById[userID].google.name,
				isOwner: global.users.usersById[userID].sites[siteID]
			});
	return res;
}

/*function authUser() {
	return everyauth.loggedIn ? everyauth.user.id : false;
}*/

exports.grantSite = function(toUserID, siteID, isOwner) {
	global.users.usersById[toUserID].sites[siteID] = isOwner;
	storage.flush();
}

exports.revokeSite = function(toUserID, siteID) {
	delete global.users.usersById[toUserID].sites[siteID];
	storage.flush();
}

exports.addSite = function(userID, name) {
	var siteID = global.sites.nextSiteId++;
	global.sites.sitesById[siteID] = {id: siteID, name: name};
	exports.grantSite(userID, siteID, true);
	storage.flush();
	return siteID;
}

exports.editSite = function(siteID, name) {
	global.sites.sitesById[siteID].name = name;
	storage.flush();
}

exports.delSite = function(siteID) {
	var users = exports.getSiteUsers(siteID);
	for (var i=0; i<users.length; i++) exports.revokeSite(users[i].id, siteID);
	delete global.sites.sitesById[siteID]; //TODO: delete DB files as well
	storage.flush();
}

exports.isSite = function(siteID) {
	return (siteID in global.sites.sitesById);
}

