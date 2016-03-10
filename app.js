var express = require('express')
	, methodOverride = require('method-override')
	, bodyParser = require('body-parser')
	, http = require('http')
	, fs = require('fs')
	, routes = require('./routes')
	, db = require('./lib/db')
	, user = require('./lib/user')
	, my = require('./lib/my')
	, conf = require('./lib/conf')
	, storage = require('./lib/storage')
	, everyauth = require('everyauth')
	, errorHandler = require('errorhandler')
	, cookieParser = require('cookie-parser')
	, session = require('express-session')
	, RedisStore = require('connect-redis')(session)
	, redis = require('redis')
	, morgan = require('morgan')
	, heapdump = require('heapdump')
;

global.cookieParser = cookieParser(conf.secret);

global.redisClient = redis.createClient('/var/run/redis/redis.sock');
global.store = new RedisStore({client: global.redisClient});
global.session = session({
	key: 'sid',
	secret: conf.secret,
	store: global.store,
	resave: true,
	saveUninitialized: false,
	cookie: { secure: true }
});

everyauth.everymodule.findUserById( function (id, callback) { callback(null, global.users.usersById[id]); });
everyauth.google
	.appId(conf.google.clientId)
	.authQueryParam({ access_type:'online', approval_prompt:'auto' })
	.appSecret(conf.google.clientSecret)
	.scope('openid profile email')
	.findOrCreateUser(user.findOrCreateUser)
	.redirectPath('/');

var app = express();
var accessLogStream = fs.createWriteStream(__dirname + '/var/log/access.log', {flags: 'a'});
app.use(morgan(':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms', {stream: accessLogStream }));
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(global.cookieParser);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(global.session);
app.use(everyauth.middleware(app));

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('trust proxy', 'loopback');

//app.use(express.errorHandler());
app.use(errorHandler({ dumpExceptions: true, showStack: true }));

// Routes
var router = express.Router();
router.get('/', routes.index);
router.get('/hit', routes.hit);
router.get('/test', routes.test);
router.get('/welcome', routes.welcome);
router.post('/welcome', routes.welcome_post);
router.post('/users/:action', routes.users);
router.post('/sites/:action', routes.sites);
app.use('/', router);
app.use(express.static(__dirname + '/static'));

// Server
var server = global.server = http.createServer(app);
server.listen(8081, '127.0.0.1', function(){ console.log("Express server started %s mode", app.settings.env); });
var wss = require('./lib/wss');

storage.init('users', {
	usersById: {},
	nextUserId: 1,
});
storage.init('sites', {
	nextSiteId: 5,
	sitesById: {
		'1': {id: 1, name: 'test.com'},
	}
});

console.log("Started at "+(new Date().toString()));

module.exports = app;

