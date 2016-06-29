var urlObjectsJSON = null;
var urlObjects = [];
var groupObjectsJSON = null;
var groupObjects = [];

            const {remote} = require('electron');
            const {Menu, MenuItem} = remote;

            var appMenu = new Menu();

            Menu.setApplicationMenu(null);

            window.$ = window.jQuery = require('./jquery-2.1.4.min.js');

            require('./jquery-ui-1.11.4.custom/jquery-ui.js');

            function reportToSlackWebHookUrl(urlObject, text)
            {
                var payload = {};
                payload.username = urlObject.siteName + ' status checker';
                payload.icon_emoji = ':warning:';

                text = text.replace(/<br\/>/g, '\n');
                text = text.replace(/<hr\/>/g, '');

                if (typeof urlObject.slackNotifyEveryone != undefined && urlObject.slackNotifyEveryone == true) {
                    text = '<!everyone>\n' + text;
                    payload.channel = "#general";
                }
                else {
                    text = '<!channel>\n' + text;
                }

                payload.text = text;

                var jsonPayload = JSON.stringify(payload);

                $.ajax
                ({
                    type: "POST",
                    url: urlObject.slackWebHookUrl,
                    dataType: 'json',
                    data: jsonPayload,
                    timeout: 3000,
                    contentType: "application/json; charset=utf-8"
                });

            }

            function reportFailure(urlObject, text)
            {
                if (typeof urlObject.slackWebHookUrl != 'undefined') {
                    reportToSlackWebHookUrl(urlObject, text);
                }
            }

            function getFailureCountThreshold()
            {
                return 3;
            }

            function getReportingFrequencyMultiplier()
            {
                return 10;
            }

            function getErrorText(status, statusText)
            {
                var errorText = status;

                switch (status)
                {
                    case 0: errorText = 'Connection error'; break;

                }

                errorText += ' (' + statusText + ')'

                return errorText;
            }

            function getRequestDelay()
            {
                var requestDelaySeconds = 240 + Math.floor(Math.random()*240);

                return requestDelaySeconds * 1000;
            }

            function getInitialRequestDelay(index)
            {
                var requestDelaySeconds = 1 + (index * 0.5);

                return requestDelaySeconds * 200;
            }
            function stripUrl(url) {
                url = url.split('/');
                url = url[2];
                if(url.indexOf('www.') == -1) {
                    url = 'www.'+url;
                }
                return url;
            };

            function checkUrlObject(index, urlObject)
            {
                var titlePrefix = '';
                titlePrefix += 'Site name: ' + urlObject.siteName + '<br/>'
                titlePrefix += 'Page name: ' + urlObject.pageName + '<br/>'
                titlePrefix += 'URL: ' + urlObject.url + '<br/><hr/>';

                var placeholderImageUrl = 'https://placeholdit.imgix.net/~text?txtsize=36&txt='+encodeURIComponent(urlObject.siteName)+'&w=128&h=128&txttrack=0';

                if (!$('#urlObject'+index).length) {
                    var imgUrl = stripUrl(urlObject.url);
                    $('#urlObjects #'+urlObject.groupId+'Group').append('<div class="urlObjectParent" id="urlObject'+index+'" title="'+titlePrefix+' Not yet checked"><img src="https://logo.clearbit.com/'+imgUrl+'" onerror="this.src=\''+placeholderImageUrl+'\'"><div class="urlObjectLight"  ></div><div class="urlObjectPageName">'+urlObject.pageName+'</div>');
										doSetTimeout(index, urlObject, false);
										return;
								}

                if (typeof urlObject.failures == 'undefined') {
                    urlObject.failures = 0;
                }

                if (typeof urlObject.startedDate == 'undefined') {
                    urlObject.startedDate = null;
                }

                if (typeof urlObject.testError == 'undefined') {
                    urlObject.testError = false;
                }

                if (urlObject.testError == true) {
                    urlObject.failures = getFailureCountThreshold();
                    if (urlObject.startedDate===null) urlObject.startedDate = Date();
                    var colour = '#e74c3c',
                    borderColour = '#c0392b';
                    $('#urlObject'+index+' > .urlObjectLight').css('background-color', colour);
                    $('#urlObject'+index+' > .urlObjectLight').css('border', '1px solid '+ borderColour + '');
                    $('#urlObject'+index).attr('title', "Test error!");
                    return;
                }

                $('#urlObject'+index+' > .urlObjectLight').css('border', '1px solid #bdc3c7');
                $('#urlObject'+index+' > .urlObjectLight').parent().addClass('scaleIn');

                $.ajax({
                    url: urlObject.url,
                    timeout: urlObject.timeout
                }).fail(function(jqXHR, textStatus, errorThrown)
                {
                    urlObject.failures++;
                    if (urlObject.startedDate===null) urlObject.startedDate = Date();

                    var title = titlePrefix;
                    title += 'Problem: '+ getErrorText(jqXHR.status, jqXHR.statusText) + '<br/>';

                    if (jqXHR.statusText=='timeout')
                    {
                      title += 'Timeout setting: ' + (urlObject.timeout/1000) + ' seconds<br/>';
                    }

                    title += 'Ocurrences: ' + urlObject.failures + '<br/>';
                    title += 'Started: ' + urlObject.startedDate + '<br/>';

                    var colour = '#e74c3c',
                    borderColour = '#c0392b';

                    if (urlObject.failures < getFailureCountThreshold()) {
                        colour = '#e67e22'
                        borderColour = '#d35400';
                    }

                    if (urlObject.failures == getFailureCountThreshold()) {
                        reportFailure(urlObject, title);
                    }
                    else if (urlObject.failures > getFailureCountThreshold() && urlObject.failures % (getFailureCountThreshold()*getReportingFrequencyMultiplier()) == 0) {
                        reportFailure(urlObject, title);
                    }

                    $('#urlObject'+index+' > .urlObjectLight').css('background-color', colour);
                    $('#urlObject'+index+' > .urlObjectLight').css('border', '1px solid '+ borderColour + '');
                    $('#urlObject'+index).attr('title', title);

                }).done(function(data){

                    var inpageErrors = [];

                    var minPageSize = 1024 * 1;

                    if (data.indexOf('Deprecated') > -1 && data.indexOf(' on line ') > -1) {
                        inpageErrors.push('PHP Deprecated');
                    }

                    if (data.indexOf('Notice') > -1 && data.indexOf(' on line ') > -1) {
                        inpageErrors.push('PHP Notice');
                    }

                    if (data.indexOf('Warning') > -1 && data.indexOf(' on line ') > -1) {
                        inpageErrors.push('PHP Warning');
                    }

                    if (data.indexOf('Fatal error') > -1 && data.indexOf(' on line ') > -1) {
                        inpageErrors.push('PHP Fatal Error');
                    }

                    if (data.length<minPageSize) {
                        inpageErrors.push('Page size is below '+minPageSize+' bytes.');
                    }

                    if (inpageErrors.length>0) {

                        urlObject.failures++;
                        if (urlObject.startedDate===null) urlObject.startedDate = Date();

                        var title = titlePrefix;

                        for (var i = 0; i < inpageErrors.length; i++) {
                            title += 'Problem '+(i+1)+': '+ inpageErrors[i] + '<br/>';
                        }

                        title += 'Ocurrences: ' + urlObject.failures + '<br/>';
                        title += 'Started: ' + urlObject.startedDate + '<br/>';

                        var colour = '#c0392b',
                        borderColour = '#c0392b';

                        if (urlObject.failures < getFailureCountThreshold()) {
                            colour = '#f39c12'
                            borderColour = '#d35400';
                        }

                        if (urlObject.failures == getFailureCountThreshold()) {
                            reportFailure(urlObject, title);
                        }
                        else if (urlObject.failures > getFailureCountThreshold() && urlObject.failures % (getFailureCountThreshold()*getReportingFrequencyMultiplier()) == 0) {
                            reportFailure(urlObject, title);
                        }

                        $('#urlObject'+index+' > .urlObjectLight').css('background-color', colour);
                        $('#urlObject'+index+' > .urlObjectLight').css('border', '1px solid '+ borderColour +'');
                        $('#urlObject'+index).attr('title', title);

                    }
                    else {

                        urlObject.failures = 0;
                        urlObject.startedDate = null;

                        var title = titlePrefix + 'No problems detected.';

                        $('#urlObject'+index+' > .urlObjectLight').css('background-color', '#2ecc71');
                        $('#urlObject'+index+' > .urlObjectLight').css('border', '1px solid #27ae60');
                        $('#urlObject'+index).attr('title', title);

                    }

                }).always(function()
                {
                    $('#urlObject'+index+' > .urlObjectLight').parent().removeClass('scaleIn');
                    $('#urlObject'+index+' > .urlObjectLight').parent().addClass('scaleOut');
                    doSetTimeout(index, urlObject, false);

                });
            }

            function doSetTimeout(index, urlObject, initial) {

				var delay = null;

				if (initial) {
					delay = getInitialRequestDelay(index);
				} else {
					delay = getRequestDelay();
				}

				setTimeout(function() { checkUrlObject(index, urlObject); }, delay);
			}

            function beginChecks()
            {
				for (var i = 0; i < urlObjects.length; ++i) {
					doSetTimeout(i, urlObjects[i], true);
				}
			}

            function checkIfConfigChanged()
            {
							$.get( "config/groups.json", function( response ) {

								if (groupsJSON != response) {
										location.reload();
										return;
								}

                $.get( "config/urls.json", function( response ) {

                    if (urlObjectsJSON != response) {
                        location.reload();
												return;
                    }

                    setTimeout(function() { checkIfConfigChanged(); }, 5000 );

                }, "text");

							}, "text");
            }

            $(document).ready(function(){

                $( document ).tooltip({
                    content: function () {
                        return $(this).prop('title');
                    }
                });

								$.get( "config/groups.json", function( response ) {

									groupsJSON = response;

									try
									{
										groupObjects = JSON.parse(groupsJSON);
									}
									catch (e)
									{
										alert('Your `groups.json` file could not be parsed. \nPlease check its syntax. \n\nDetails: '+e.message);
										location.reload();
										return;
									}

									for (var i = 0; i < groupObjects.length; i++) {
										var groupObject = groupObjects[i];

										var templateHTML = $('#groupTemplate').html();
										templateHTML = templateHTML.replace('[[id]]', groupObject.id);
										templateHTML = templateHTML.replace('[[name]]', groupObject.name);
										templateHTML = templateHTML.replace('[[description]]', groupObject.description);

										$('#urlObjects').append(templateHTML);
									}

	                $.get( "config/urls.json", function( response ) {

	                    urlObjectsJSON = response;

	                    try
	                    {
	                      urlObjects = JSON.parse(urlObjectsJSON);

	                      urlObjects.sort(function(a,b) {return (a.siteName > b.siteName) ? 1 : ((b.siteName > a.siteName) ? -1 : 0);} );
	                    }
	                    catch (e)
	                    {
	                      alert('Your `urls.json` file could not be parsed. \nPlease check its syntax. \n\nDetails: '+e.message);
	                      location.reload();
	                      return;
	                    }
	                    beginChecks();

	                    checkIfConfigChanged();
	                }, "text");
	            	}, "text");

							});
