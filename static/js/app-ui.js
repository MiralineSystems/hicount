
function showUsersDialog() {
	$.post('/users/list', {siteID: poll.siteID}, function(data) {
		//console.log(data);

		$('#dialog-users-content').html('');
		var template = $.templates("#usersTmpl");
		template.link($('#dialog-users-content'), data);

		$("#dialog-users").dialog({
			resizable: false,
			width: 700,
			height: 400,
			modal: true,
			buttons: {
				'Add New User': function() {
					$(this).dialog( 'close' );
					showAddUserDialog();
				},
				'Close': function() {
					$(this).dialog( 'close' );
				}
			}
		});
	});
	return false;
};

function showAddUserDialog() {
	$("#dialog-adduser").dialog({
		resizable: false,
		width: 400,
		height: 300,
		modal: true,
		buttons: {
			Add: function() {
				var req = {siteID: poll.siteID, email: $('#adduser-email').val(), isOwner: $('#adduser-owner').is(':checked') };
				//console.log('add user: sending: '); console.log(req);
				var dialog = $(this);
				$.post('/users/add', req, function(data) {
					if (data.error) {
						alert('Error: '+data.error);
					} else {
						alert('User access granted');
						dialog.dialog( 'close' );
						showUsersDialog();
					}
				});
			},
			Cancel: function() {
				$(this).dialog('close');
				//showUsersDialog();
			}
		}
	});
	return false;
}

function delUser() {
	//console.log('delUser:');
	var req = {siteID: poll.siteID, toUserID: parseInt($(this).attr('userID'))};
	//console.log(req);
	$.post('/users/del', req, function(data) {
		if (data.error) {
			alert('Error: '+data.error);
		} else {
			alert('User access revoked');
			$("#dialog-users").dialog('close'); showUsersDialog();
		}
	});
	return false;
}

function showSitesDialog() {
	$.post('/sites/list', {}, function(data) {
		//console.log(data);

		$('#dialog-sites-content').html('');
		var template = $.templates("#sitesTmpl");
		template.link($('#dialog-sites-content'), data);

		$("#dialog-sites").dialog({
			resizable: false,
			width: 700,
			height: 400,
			modal: true,
			buttons: {
				'Add New Site': function() {
					$(this).dialog( 'close' );
					showAddSiteDialog();
				},
				'Close': function() {
					$(this).dialog( 'close' );
					changeCur(0);
				}
			}
		});
	});
	return false;
};

function showAddSiteDialog() {
	$("#dialog-addsite").dialog({
		resizable: false,
		width: 400,
		height: 300,
		modal: true,
		buttons: {
			Add: function() {
				var req = {name: $('#addsite-name').val() };
				//console.log('add site: sending: '); console.log(req);
				var dialog = $(this);
				$.post('/sites/add', req, function(data) {
					if (data.error) {
						alert('Error: '+data.error);
					} else {
						alert('Site created');
						dialog.dialog( 'close' );
						showSitesDialog();
					}
				});
			},
			Cancel: function() {
				$(this).dialog('close');
				//showSitesDialog();
			}
		}
	});
	return false;
}

function delSite() {
	//console.log('delSite:');
	var req = {siteID: parseInt($(this).attr('siteID'))};
	//console.log(req);
	$.post('/sites/del', req, function(data) {
		if (data.error) {
			alert('Error: '+data.error);
		} else {
			alert('Site deleted');
			$("#dialog-sites").dialog('close'); showSitesDialog();
		}
	});
	return false;
}

function editSite() {
	//console.log('editSite:');
	var tr = $(this).closest('tr');
	var span = tr.find('.siteName');
	var inp = tr.find('.siteEditInput');
	inp.val(span.text());
	tr.find('.siteEditControl').show();
	tr.find('.siteViewControl').hide();
	inp.focus();
	return false;
}

function cancelSite() {
	console.log('cancelSite:');
	var tr = $(this).closest('tr');
	tr.find('.siteEditControl').hide();
	tr.find('.siteViewControl').show();
	return false;
}

function saveSite() {
	//console.log('saveSite:');
	var tr = $(this).closest('tr');
	var span = tr.find('.siteName');
	var inp = tr.find('.siteEditInput');

	var req = {siteID: parseInt($(this).attr('siteID')), name: inp.val()};
	//console.log(req);
	$.post('/sites/edit', req, function(data) {
		if (data.error) {
			alert('Error: '+data.error);
		} else {
			span.text(inp.val());
			tr.find('.siteEditControl').hide();
			tr.find('.siteViewControl').show();
			alert('Site updated');
		}
	});
	return false;
}

function showCodeDialog() {
	var code = "<script type=\"text/javascript\">\n  document.write(\"<img src='//www.hicount.org/hit?id="+poll.siteID+"&href=\"+escape(document.referrer)+\"&url=\"+escape(document.URL)+\"&rand=\"+Math.random()+\"' width=1 height=1 alt='' style='display:none'>\");\n</script>\n";
	$( '#dialog-code-textarea').val(code);
	$( "#dialog-code" ).dialog({
		modal: true,
		width: 700,
		height: 400,
		buttons: {
			Ok: function() {
				$( this ).dialog( "close" );
			}
		}
	});
	return false;
}

$(document).ready(function(){
	$(document).on('click', 'a#showUsersDialog', showUsersDialog);
	$(document).on('click', 'a.delUser', delUser);
	$(document).on('click', 'a#showSitesDialog', showSitesDialog);
	$(document).on('click', 'a#addSiteDialog', showAddSiteDialog);
	$(document).on('click', 'a.delSite', delSite);
	$(document).on('click', 'a.editSite', editSite);
	$(document).on('click', 'a.saveSite', saveSite);
	$(document).on('click', 'a.cancelSite', cancelSite);
	$(document).on('click', 'a#showCodeDialog', showCodeDialog);
});

