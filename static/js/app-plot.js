var lastData, lastFullData, statData = {}, statList = [];
var ws, hitsPlot, ipsPlot, lastFullData, poll;
var nowColor = "rgba(255, 63, 63, 0.8)";
var curColor = "#3333FF";
var prevColor = "rgba(63, 63, 63, 0.4)";

Number.prototype.pad = function(size) {
	var s = String(this);
	if(typeof(size) !== "number"){size = 2;}
	while (s.length < size) {s = "0" + s;}
	return s;
}

function changePerc(cur, prev) {
	var h = '-';
	if (prev) {
		var change = (Math.floor(cur / prev * 10000) / 100) - 100;
		var color = (change>=0 ? 'darkgreen' : 'darkred');
		h = '<font color="'+color+'"><b>'+(change>0 ? '+' : '')+parseFloat(change.toPrecision(3))+'</b>&nbsp;%</font>';
	}
	return h;
}

function nFormat(num) {
	var ret = '<b> ', sep = '</b> ';
	if (num >= 100000000000) ret += (num / 1000000000).toFixed(0).replace(/\.0$/, '') + sep + 'G';
	else if (num >= 10000000000) ret += (num / 1000000000).toFixed(1).replace(/\.0$/, '') + sep + 'G';
	else if (num >= 1000000000) ret += (num / 1000000000).toFixed(2).replace(/\.0$/, '') + sep + 'G';
	else if (num >= 100000000) ret += (num / 1000000).toFixed(0).replace(/\.0$/, '') + sep + 'M';
	else if (num >= 10000000) ret += (num / 1000000).toFixed(1).replace(/\.0$/, '') + sep + 'M';
	else if (num >= 1000000) ret += (num / 1000000).toFixed(2).replace(/\.0$/, '') + sep + 'M';
	else if (num >= 100000) ret += (num / 1000).toFixed(0).replace(/\.0$/, '') + sep + 'K';
	else if (num >= 10000) ret += (num / 1000).toFixed(1).replace(/\.0$/, '') + sep + 'K';
	else if (num >= 1000) ret += (num / 1000).toFixed(2).replace(/\.0$/, '') + sep + 'K';
	else ret += num;
	return ret;
}

function updateStat(data) {
	//console.log(data.poll.stat);
	var stat = {};
	stat.hitsPrevDayChange = changePerc(data.poll.stat.hitsCurDay, data.poll.stat.hitsPrevDay);
	stat.hitsPrevHourChange = changePerc(data.poll.stat.hitsCurHour, data.poll.stat.hitsPrevHour);
	stat.ipsPrevDayChange = changePerc(data.poll.stat.ipsCurDay, data.poll.stat.ipsPrevDay);
	stat.ipsPrevHourChange = changePerc(data.poll.stat.ipsCurHour, data.poll.stat.ipsPrevHour);

	for (var key in data.poll.stat) $('#'+key).html(nFormat(data.poll.stat[key]));
	for (var key in stat) $('#'+key).html(stat[key]);
}

function updateStats(data) {
	lastData = data;
	//document.getElementById('heapTotal').innerHTML = data.memuse.heapTotal;
	//document.getElementById('heapUsed').innerHTML = data.memuse.heapUsed;

	poll = data.poll;

	if (data.error=='NOT_AUTHED') {
		alert('Session expired, please re-login. Click OK to reload.');
		window.location = '/';
		return;
	}
	if (data.error=='NO_ACCESS') {
		alert('Access defined. Click OK to reload.');
		window.location = '/';
		return;
	}

	$('#datestr').html(data.info.datestr);

	if (data.poll.fullData) {
		lastFullData = data;
		$('#status').html('Processing...')
		//statData = {};
		
		var d = new Date(data.data[0][0]*1000);
		document.getElementById('date').innerHTML = d.getFullYear() + '-' + (d.getMonth()+1).pad(2) + '-' + d.getDate().pad(2);

		var numSitesOwned = 0;
		$('#sites').html('');
		for (var i in data.sites) {
			var site = data.sites[i];
			$('#sites').append('<option value="'+site.id+'"'+(data.poll.siteID==site.id ? ' selected="selected"' : '')+'>'+site.name+(site.isOwner ? ' (owner)' : '') + '</option>');
			numSitesOwned += site.isOwner ? 1 : 0;
		}

		$('#prevs').html('');
		for (var i in data.prevs) {
			$('#prevs').append('<option value="'+data.prevs[i]+'"'+(data.poll.prevDaysAgo==data.prevs[i] ? ' selected="selected"' : '')+'>'+data.prevs[i]+' day ago'+'</option>');
		}
		$('#prevLabelDay').html('to 24h '+data.poll.prevDaysAgo+' day ago');
		$('#prevLabelHour').html('to 1h '+data.poll.prevDaysAgo+' day ago');

		$('#granularities').html('');
		for (var i in data.granularities) {
			var gr = data.granularities[i];
			var gval;
			if (gr<60) gval = gr+' s';
			else if (gr<3600) gval = (gr/60)+' m';
			else gval = (gr/3600)+' h';
			$('#granularities').append('<option value="'+gr+'"'+(data.poll.granularity==gr ? ' selected="selected"' : '')+'>'+gval+'</option>');
		}

		$('#refreshes').html('');
		for (var i in data.refreshes) {
			$('#refreshes').append('<option value="'+data.refreshes[i]+'"'+(data.poll.refresh==data.refreshes[i] ? ' selected="selected"' : '')+'>'+data.refreshes[i]+' sec'+'</option>');
		}

		//console.log(data.info);

		if (data.info.isSiteOwner) {
			$('#showUsersDialog').show();
		} else {
			$('#showUsersDialog').hide();
		}

		if (numSitesOwned) {
			$('#showSitesDialog').show();
		} else {
			$('#showSitesDialog').hide();
		}

		$('#showCodeDialog').show();

		hitsData[0].data = [];
		hitsData[1].data = [];
		//hitsData[2].data = [];
		ipsData[0].data = [];
		ipsData[1].data = [];
		//ipsData[2].data = [];
		for (i=0; i<data.data.length; i++) {
			var list = data.data[i];
			var tm = Math.floor(list[0] * 1000);
			hitsData[0].data.push( [ tm, list[1] ] );
			hitsData[1].data.push( [ tm, list[2] ] );
			ipsData[0].data.push( [ tm, list[3] ] );
			ipsData[1].data.push( [ tm, list[4] ] );
		}

		$('#status').html('Streaming...')
		enable(true);

	} else if ('data' in hitsData[0]) {
		for (i=0; i<data.data.length; i++) {
			var list = data.data[i];
			var tm = Math.floor(list[0] * 1000);

			var found = false;
			for (var j=hitsData[0].data.length-1; j>=0; j--) {
				if (hitsData[0].data[j][0]==tm) {hitsData[0].data[j][1] = list[1]; found=true;}
				if (hitsData[0].data[j][0]<=tm) break;
			}
			if (! found) hitsData[0].data.push( [ tm, list[1] ] );

			/*
			var found = false;
			for (var j=hitsData[1].data.length-1; j>=0; j--) {
				if (hitsData[1].data[j][0]==tm) {hitsData[1].data[j][1] = list[2]; found=true;}
				if (hitsData[1].data[j][0]<=tm) break;
			}
			if (! found) hitsData[1].data.push( [ tm, list[2] ] );*/

			var found = false;
			for (var j=ipsData[0].data.length-1; j>=0; j--) {
				if (ipsData[0].data[j][0]==tm) {ipsData[0].data[j][1] = list[3]; found=true;}
				if (ipsData[0].data[j][0]<=tm) break;
			}
			if (! found) ipsData[0].data.push( [ tm, list[3] ] );

			/*
			var found = false;
			for (var j=ipsData[1].data.length-1; j>=0; j--) {
				if (ipsData[1].data[j][0]==tm) {ipsData[1].data[j][1] = list[4]; found=true;}
				if (ipsData[1].data[j][0]<=tm) break;
			}*/
			if (! found) ipsData[1].data.push( [ tm, list[4] ] );
		}
	}

	updateStat(data);

	var rts = Math.floor(data.info.realTimestamp);

	hitsPlot.getOptions().grid.markings = [{xaxis: { from: rts, to: rts}, lineWidth: 1, color: nowColor}];
	hitsPlot.getOptions().series.bars.barWidth = poll.granularity * 1000;
	hitsPlot.getOptions().xaxes[0].timeformat = (hitsPlot.getOptions().xaxes[0].max && (hitsPlot.getOptions().xaxes[0].max - hitsPlot.getOptions().xaxes[0].min < 5*60*1000) ? "%H:%M:%S" : "%H:%M");
	ipsPlot.getOptions().grid.markings = [{xaxis: { from: rts, to: rts}, lineWidth: 1, color: nowColor}];
	ipsPlot.getOptions().series.bars.barWidth = poll.granularity * 1000;
	ipsPlot.getOptions().xaxes[0].timeformat = (ipsPlot.getOptions().xaxes[0].max && (ipsPlot.getOptions().xaxes[0].max - ipsPlot.getOptions().xaxes[0].min < 5*60*1000) ? "%H:%M:%S" : "%H:%M");

	hitsPlot.setData(hitsData); hitsPlot.setupGrid(); hitsPlot.draw();
	ipsPlot.setData(ipsData); ipsPlot.setupGrid(); ipsPlot.draw();
}

function changeCur(inc) { send({curDaysAgo: poll.curDaysAgo - inc}); }

function toUTC(d) {		
	strd = d.toString();
	var y = strd.substring(0, 4);
	var m = strd.substring(4, 6);
	var d = strd.substring(6, 8);

	var n = new Date(parseInt(y), parseInt(m) - 1, parseInt(d) - 1);
	return new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0);
}

var options = {			
	series: {
		bars: {
			show: true,
			barWidth: 1000,
			lineWidth: 0,
		},
		shadowSize: 0
	},
	grid: {  
		hoverable: true,			   
		autoHighlight: true,
		backgroundColor: { colors: ["#75BAFF", "#ffffff"] }
	},
	yaxis:{
		color:"#8400FF",
		min:0.1
	},
	xaxis:{
		mode:"time",
		timeformat: "%H:%M:%S",
		color:"#8400FF",
		labelAngle: 45,
		points: { show: true },
	},
	selection:{
		mode: "x"
	}
};

var hitsData = [ {
	label: "Hits Current",
	color: curColor,
	bars: {fill: true, fillColor: curColor},
}, {
	label: "Hits Previous",
	color: prevColor,
	bars: {fill: true, fillColor: prevColor},
}, ];

var ipsData = [ {
	label: "IPs Current",
	color: curColor,
	bars: {fill: true, fillColor: curColor},
}, {
	label: "IPs Previous",
	color: prevColor,
	bars: {fill: true, fillColor: prevColor},
}, ];

function enable(on) {
	if (on) {
		$('#info-block').find(':input').prop('disabled', false);
		$('#info-block').find('a').prop('disabled', false);
		$('#info-block').find('a').removeClass('disabled');
	} else {
		$('#info-block').find(':input').prop('disabled', true);
		$('#info-block').find('a').addClass('disabled');
	}
}

function send(data) {
	enable(false);
	$('#status').html('Waiting for data...')
	ws.send(JSON.stringify($.extend({}, data, {fullData: 1})));
}

function connect() {
	enable(false);

	var host = window.document.location.host.replace(/:.*/, '');
	var port = 80;
	ws = new WebSocket('wss://' + host + (port != 80 ? ':' + port : ''));
	// ws.SetCredentials("user", "password", false);

	ws.onmessage = function (event) {
		updateStats(JSON.parse(event.data));
	};

	ws.onopen = function (event) {
		$('#status').html('Connected. Waiting for data...')
		ws.send(JSON.stringify({start: true, fullData: true}));
	};

	ws.onclose = function (event) {
		$('#status').html('Disconnected.');
		setTimeout(function(){ $('#status').html('Trying to reconnect...'); connect(); }, 1000);
	};
}

function showTooltip(x, y, contents) {
	$('<div id="tooltip">' + contents + '</div>').css( {
		position: 'absolute',
		display: 'none',
		top: y - 35,
		left: x + 5,
		border: '1px solid #fdd',
		padding: '2px',
		'background-color': '#fee',
		opacity: 0.80
	}).appendTo("body").fadeIn(200);
}

var previousPoint = null;

$(document).ready(function () { 
	$('#status').html('Connecting...')
	connect();

	function onHover(event, pos, item) {
		$("#x").text(pos.x.toFixed(2));
		$("#y").text(pos.y.toFixed(2));
		if (item) {
			if (previousPoint != item.datapoint) {
				previousPoint = item.datapoint;
				$("#tooltip").remove();
				var x = item.datapoint[0].toFixed(0), y = item.datapoint[1].toFixed(0);
				var ts1 = (new Date(parseInt(x))).toTimeString(); ts1 = ts1.substring(0, ts1.indexOf(' '));
				var ts2 = (new Date(parseInt(parseInt(x)+(poll.granularity-1)*1000))).toTimeString(); ts2 = ts2.substring(0, ts2.indexOf(' '));
				var what = item.series.label.substring(0, item.series.label.indexOf(' ')).toLowerCase();
				var label = item.series.label.substring(item.series.label.indexOf(' ')+1).toLowerCase();
				showTooltip(item.pageX, item.pageY, y + ' ' + what + ' at ' + ts1 + (ts1==ts2 ? '' : '-' + ts2) + ' [' + label + ']');
			}
		} else {
			$("#tooltip").remove();
			previousPoint = null;			
		}

	}

	hitsPlot = $.plot($("#graph-block #hitsContainer"), hitsData, options);
 
	$("#graph-block #hitsContainer").bind("plotselected", function (event, ranges) {
		hitsPlot = $.plot($("#graph-block #hitsContainer"), hitsData,
			  $.extend(true, {}, options, {
				  xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to }
			  }));
		ipsPlot = $.plot($("#graph-block #ipsContainer"), ipsData,
			  $.extend(true, {}, options, {
				  xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to }
			  }));
	}).bind("dblclick", function (){
		hitsPlot = $.plot($("#graph-block #hitsContainer"), hitsData, options);
		ipsPlot = $.plot($("#graph-block #ipsContainer"), ipsData, options);
	}).bind("plothover", onHover);

	ipsPlot = $.plot($("#graph-block #ipsContainer"), ipsData, options);
 
	$("#graph-block #ipsContainer").bind("plotselected", function (event, ranges) {		
		hitsPlot = $.plot($("#graph-block #hitsContainer"), hitsData,
			  $.extend(true, {}, options, {
				  xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to }
			  }));
		ipsPlot = $.plot($("#graph-block #ipsContainer"), ipsData,
			  $.extend(true, {}, options, {
				  xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to }
			  }));
	}).bind("dblclick", function (){
		hitsPlot = $.plot($("#graph-block #hitsContainer"), hitsData, options);
		ipsPlot = $.plot($("#graph-block #ipsContainer"), ipsData, options);
	}).bind("plothover", onHover);

	$('#sites').on('change', function (e) {
		send({siteID: parseInt(this.value), granularity: 0, curDaysAgo: 0});
	});
	$('#granularities').on('change', function (e) {
		send({granularity: parseInt(this.value)});
	});
	$('#refreshes').on('change', function (e) {
		send({refresh: parseFloat(this.value)});
	});
	$('#prevs').on('change', function (e) {
		send({prevDaysAgo: parseInt(this.value)});
	});
	
});
