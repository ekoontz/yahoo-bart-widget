const cFiveMinutesMS		= 300000;
const cOneHourMS 			= 3600000;

var gBtnIconColor			= "#878787";
var gBtnIconSelectedColor	= "#FFFFFF";
var gDockIndex				= -2;
var gDockData				= [];
var gDockStockDeltaStyle	= "font-family: Helvetica, Arial; font-size: 14px; font-weight: bold";
var gChartFadeTransition 	= 500;
var gCurrentNewsNode		= null;
var gDefaultSearchLabel		= "Enter a name or symbol above";
var gExpandedViewHeight		= 197;
var gBumpStamp				= null;
var gCollapsedPosition		= null;
var gLastPosition			= null;
var gNewsDOM				= XMLDOM.parse( filesystem.readFile( "news.rss" ) );
var gDefaultNewsDOM			= XMLDOM.parse( filesystem.readFile( "news.rss" ) );
var gInactiveTextColor		= "#A4A4A4";
var gInactiveControlOpacity	= 0.5;
var gOldPrefs				= [];

var header 					= widget.getElementById( "header" );
var footer 					= widget.getElementById( "footer" );
var bodyBackground 			= widget.getElementById( "bodyBackground" );
var lastUpdatedBar 			= widget.getElementById( "lastUpdatedBar" );
var upperContent 			= widget.getElementById( "upperContent" );
var upperContentContainer	= widget.getElementById( "upperContentContainer" );
var upperContentOrnaments	= widget.getElementById( "upperContentOrnaments" );
var upperContentScrollbar	= widget.getElementById( "upperContentScrollbar" );
var lowerContent 			= widget.getElementById( "lowerContent" );
var chartsPanel 			= widget.getElementById( "chartsPanel" );
var chartsPanelLowerShadow	= widget.getElementById( "chartsPanelLowerShadow" );
var searchPanel 			= widget.getElementById( "searchPanel" );
var newsPanel 				= widget.getElementById( "newsPanel" );

var vitalityDoc = XMLDOM.parse( filesystem.readFile( "vitality.xml" ) );

initWidgetFunctions( );

initWidgetDB( );

initWidgetWindow( );

// -------------------------------------------------------------------------------------------

function addSymbol( )
{
	var popup = searchPanel.getElementById( "searchResults" );

	var result = financeDB.query( "SELECT * FROM quotes WHERE symbol = '" + sqlEscape( popup._symbol ) + "'" );
	var results = result.getAll( );

	result.dispose( );

	if( results.length != 0 )
	{
		alert( "The symbol " + popup._symbol + " is already in your list." );
		return;
	}

	financeDB.exec( "INSERT INTO quotes ( symbol, fullName, timestamp ) VALUES ( '" + sqlEscape( popup._symbol ) + "', '" + sqlEscape( popup._name ) + "', '0' )" );
	financeDB.exec( "INSERT INTO news VALUES ( '" + sqlEscape( popup._symbol ) + "', 0, 0, '' )" );

	var result = financeDB.query( "SELECT * FROM quotes ORDER BY sortkey DESC" );
	var quote = result.getRow( );
	result.dispose( );

	stockLine = new StockLine( );
	stockLine.id = "id_" + quote["sortkey"];
	stockLine.symbol = quote["symbol"];
	stockLine.fullName = quote["fullName"];
	stockLine.vOffset = upperContent.lastChild ? upperContent.lastChild.vOffset + upperContent.lastChild.height : 0;


	stockLine.stockName.data = stockLine.stockName2.data = stockLine.fullName;
	stockLine.stockSymbol.data = stockLine.stockSymbol2.data = stockLine.symbol;

	if( preferences.chartsPanelDisplayed.value == 1 )
		setTooltip( stockLine.hitTarget, "Show chart for " + stockLine.symbol );
	else
		setTooltip( stockLine.hitTarget, "Open web page for " + stockLine.symbol );

	upperContent.appendChild( stockLine );
}

// -------------------------------------------------------------------------------------------

function animateLowerContent( )
{
	function setSize( windowHeight )
	{	
		mainWindow.height = windowHeight;
		bodyBackground.height = windowHeight - header.height - footer.height;
		lowerContent.height = chartsPanelLowerShadow.vOffset = windowHeight - lowerContent.vOffset - footer.height;
		footer.vOffset = mainWindow.height - footer.height;
	}

	var percent = ( animator.milliseconds - this.startTime ) / this.duration;

	var windowHeight = animator.ease( this.startHeight, this.endHeight, percent, animator.kEaseOut );

	setSize( Math.floor( windowHeight ) );

	if( this.finalState == "open" && ( mainWindow.vOffset + mainWindow.height ) > this.screenHeight )
	{
		if( !gBumpStamp && !gCollapsedPosition )
		{
			gBumpStamp = mainWindow.vOffset;
		}
		mainWindow.vOffset = this.screenHeight - mainWindow.height;
	}
	else if( gCollapsedPosition )
	{
		if( mainWindow.vOffset < gCollapsedPosition )
		{
			mainWindow.vOffset = this.screenHeight - mainWindow.height;
		}
		else
		{
			mainWindow.vOffset = gCollapsedPosition;
			gCollapsedPosition = null;
		}
	}

	if( animator.milliseconds >= ( this.startTime + this.duration ) )
	{
		setSize( this.endHeight );

		if( gBumpStamp )
		{
			gCollapsedPosition = gBumpStamp;
			gBumpStamp = null;
		}

		gLastPosition = mainWindow.vOffset;

		return false;
	}

	return true;
}

// -------------------------------------------------------------------------------------------

function animateStockLines( direction )
{
	var finish = ( direction == "left" ) ? -244 : 0;
	var vOffset = 0;
	var duration = 250;
	
	var anim = [new MoveAnimation( upperContent, finish, upperContent.vOffset, duration, animator.kEaseOut )];

	if( direction == "right" )
	{
		var stockLine = upperContent.firstChild;
		
		while( stockLine )
		{
			if( stockLine.stockName2.opacity != 255 ) // Line flagged for deletion?
			{
				vOffset += 28;
				stockLine.hOffset = 488;
			}
			else if( vOffset != 0 )
			{
				anim.push( new MoveAnimation( stockLine, 0, stockLine.vOffset - vOffset, duration, animator.kEaseOut ) );
			}
					
			stockLine = stockLine.nextSibling;
		}
	}
	return anim;
}

// -------------------------------------------------------------------------------------------

function chartDataComplete( url )
{
	if ( url.response != 200 || url.result == "Could not load URL")
	{

		// Failed

	}
	else
	{
		try
		{
			var chartDOM = XMLDOM.parse( url.responseData );
		}
		catch( e )
		{
			// Failed
			
			var chartDOM = null;
		}

		var nowTime = Date.parse( new Date( ) );

		if( chartDOM )
		{
			financeDB.exec( "INSERT INTO chart VALUES ( '" + url.symbol + "', '" + url.range + "', '" + nowTime + "', '" + sqlEscape( url.responseData ) + "' )" );
	
			renderChart( chartDOM );
		}
	}
}
 
// -------------------------------------------------------------------------------------------

function ChartMessage( obj )
{
	var text = new Text( );
	text.hAlign = "center";
	text.style.fontFamily = "helvetica, arial";
	text.style.fontWeight = "bold";
	text.style.fontSize = "12px";
	text.style.color = "#535353";
	text.hOffset = obj.width / 2;
	text.vOffset = obj.height / 2;
	
	return text;
}

// -------------------------------------------------------------------------------------------

function checkForModifiedStockLines( )
{
	var stockLine = upperContent.firstChild;
	var sqlString = "";
	var deleteList = [];
	
	while( stockLine )
	{
		if( stockLine.stockName2.opacity != 255 )
		{
			deleteList.push( stockLine );
			
			if( sqlString != "" )
				sqlString += " OR ";
			
			sqlString += "symbol = '" + sqlEscape( stockLine.symbol ) + "'";

 			if( preferences.selectedSymbol.value == stockLine.symbol )
 				preferences.selectedSymbol.value = "";
		}

		stockLine = stockLine.nextSibling;
	}

	if( deleteList.length != 0 )
	{
		for( var i = 0; i < deleteList.length; i++ )
			upperContent.removeChild( deleteList[i] );
	
		financeDB.exec( "DELETE FROM chart WHERE " + sqlString );
		financeDB.exec( "DELETE FROM quotes WHERE " + sqlString );
		financeDB.exec( "DELETE FROM news WHERE " + sqlString );
	}

	// Resort, in case any were reordered.

	var stockLine = upperContent.firstChild;
	var index = 1;

	while( stockLine )
	{
		stockLine.id = "id_" + index;
		financeDB.exec( "UPDATE quotes SET sortkey = -" + index + " WHERE sortkey = " + index );
		financeDB.exec( "UPDATE quotes SET sortkey = " + index + " WHERE symbol = '" + sqlEscape( stockLine.symbol ) + "'" );
		index++;

		stockLine = stockLine.nextSibling;
	}

	getQuotes( );

	// Make sure the dock is in sync
	
	rotateDock( true );
}

// -------------------------------------------------------------------------------------------

function clearChartsPanel( )
{
	chartsPanel.removeChild( chartsPanel.firstChild );

	var chart = new Frame( );
	chart.frameType = "text";
	chart.width = 244;
	chart.height = 119;
	chart.hOffset = 6;
	chart.vOffset = 77;

	var text = new ChartMessage( chart );
	text.data = "Click a listing to show its chart";
	chart.appendChild( text );

	chartsPanel.appendChild( chart );
	chart.orderBelow( );

	gNewsDOM = gDefaultNewsDOM;
	gCurrentNewsNode = gNewsDOM.evaluate( "rss/channel/item" ).item( 0 );
	rotateNews( );
}

// -------------------------------------------------------------------------------------------

function clearSearchField( )
{
	var searchField = searchPanel.getElementById( "searchField" );
	searchField.data = "";
	searchField.loseFocus( );
	searchField.onLoseFocus( );
}

// -------------------------------------------------------------------------------------------

function getNews( )
{
	var timestamp = Date.parse( new Date );

	var result = financeDB.query( "SELECT lastBuildDate FROM news WHERE symbol = '" + sqlEscape( preferences.selectedSymbol.value ) + "' AND ( timestamp < " + ( timestamp - cOneHourMS ) + " OR timestamp > " + timestamp + " )"  );
	var results = result.getAll( );
	result.dispose( );

	if( results.length > 0 )
	{
		var url = new URL();
		url.autoRedirect = false;
		url.location = "http://finance.yahoo.com/rss/headline?s=" + escape( preferences.selectedSymbol.value );
		url.lastBuildDate = results[0]["lastBuildDate"];
		url.selectedSymbol = preferences.selectedSymbol.value;

		url.fetchAsync( getNewsComplete );
	}
	else
	{
		var result = financeDB.query( "SELECT storedXML FROM news WHERE symbol = '" + sqlEscape( preferences.selectedSymbol.value ) + "'"  );
		var results = result.getAll( );
		result.dispose( );

		var tempNewsDOM = XMLDOM.parse( results[0]["storedXML"] );

		if( gNewsDOM.toXML( ) != tempNewsDOM.toXML( ) )
		{
			gNewsDOM = tempNewsDOM;
			gCurrentNewsNode = gNewsDOM.evaluate( "rss/channel/item" ).item( 0 );

			if( !gCurrentNewsNode )
			{
				gNewsDOM = gDefaultNewsDOM;
				gCurrentNewsNode = gNewsDOM.evaluate( "rss/channel/item" ).item( 0 );
			}

			newsTimer.reset( );
			rotateNews( );
		}
	}
}

// -------------------------------------------------------------------------------------------

function getNewsComplete( url )
{
	var timestamp = Date.parse( new Date( ) );

	if( url.result.length == 0 || url.result == "Could not load URL" || url.response != 200 ) // Symbols not found try to redirect to an HTML search page
	{
		// Failed

		var result = financeDB.query( "SELECT storedXML FROM news WHERE symbol = '" + sqlEscape( url.selectedSymbol ) + "'"  );
		var results = result.getAll( );
		result.dispose( );

		if( results.length > 0 )
			gNewsDOM = XMLDOM.parse( results[0]["storedXML"] );
		else
			gNewsDOM = gDefaultNewsDOM;

		gCurrentNewsNode = gNewsDOM.evaluate( "rss/channel/item" ).item( 0 );

		return;
	}

	var tempDOM = XMLDOM.parse( url.result );

	var newLastBuildDate = Date.parse( tempDOM.evaluate( "string( rss/channel/lastBuildDate )" ).replace( / Etc\//gi, " " ) ); // FIXME What is Etc/GMT?
	var currentLastBuildDate = Date.parse( gNewsDOM.evaluate( "string( rss/channel/lastBuildDate )" ).replace( / Etc\//gi, " " ) ); // FIXME What is Etc/GMT?

	if( newLastBuildDate != currentLastBuildDate )
	{
		gNewsDOM = tempDOM;

		gCurrentNewsNode = gNewsDOM.evaluate( "rss/channel/item" ).item( 0 );
		
		if( !gCurrentNewsNode )
		{
			gNewsDOM = gDefaultNewsDOM;
			gCurrentNewsNode = gNewsDOM.evaluate( "rss/channel/item" ).item( 0 );
		}

		rotateNews( );

		financeDB.exec( "UPDATE news SET timestamp = " + timestamp + ", lastBuildDate = " + newLastBuildDate + ", storedXML = '" + sqlEscape( url.result.replace(/\r|\n|\t|/g, "") ) + "'  WHERE symbol = '" + sqlEscape( url.selectedSymbol ) + "'" );
	}
}

// -------------------------------------------------------------------------------------------

function getQuotes( )
{
	var timestamp = Date.parse( new Date );

	var result = financeDB.query( "SELECT symbol FROM quotes WHERE ( timestamp < " + ( timestamp - cFiveMinutesMS ) + " OR timestamp > " + timestamp + " )"  );
	var results = result.getAll( );
	result.dispose( );

	if( results.length > 0 )
	{
		var url = new URL();
		url.location = "http://finance.yahoo.com/d?s=";

		for( var i = 0; i < results.length; i++ )
		{
			if( i > 0 )
				url.location += "+";
				
			url.location += escape( results[i]["symbol"] );
		}
	
		url.location += "&f=s0l1t1cn";
	
		url.fetchAsync( getQuotesComplete );
	}
}

// -------------------------------------------------------------------------------------------

function getQuotesComplete( url )
{
	if( url.result.length == 0 || url.result == "Could not load URL") 
	{
		// Failed
		return;
	}

	var theDate = new Date( );
	var theHour = String( theDate.getHours( ) );
	var theMinutes = String( theDate.getMinutes( ) );
	var timestamp = Date.parse( theDate );

	if( theMinutes.length == 1 )
		theMinutes = "0" + theMinutes;

	if( theHour > 12 )
	{
		theHour = String( theHour - 12 );
		var amPM = "pm";
	}
	else
	{
		var amPM = "am";
	}

	if( theHour == 12 )
		amPM = "pm";

	if( theHour == 0 )
		theHour = "12";

	lastUpdatedBar.lastChild.data = preferences.lastUpdated.value = "Last update " + theHour + ":" + theMinutes + amPM;

	var quoteLines = url.result.split( "\n" );

	if( quoteLines.length > 0 )
	{
		for( var i = 0; i < quoteLines.length; i++ )
		{
			if( quoteLines[i] != "" )
			{
				var parts = quoteLines[i].split( "," );
				
				var symbol			= parts[0].replace( /"/g, "" );
				var lasttrade		= parts[1];
				var change			= parts[3].replace( /["%]/g, "" ).split( " - " )[0];
				var changePercent	= parts[3].replace( /["%]/g, "" ).split( " - " )[1];
		
				financeDB.exec( "UPDATE quotes SET lasttrade = " + lasttrade + ", change = " + change + ", timestamp = " + Date.parse( theDate ) + ", changePercent = " + changePercent + " WHERE symbol = '" + sqlEscape( symbol ) + "'" );
			}
		}
		updateStockDisplay( );
	}
	
	// Is the chart showing? Displaying 1d range? Update.
	// generateChart( ) does a check to get new data no more than once per hour, so we don't do an additional check here.
	
	if( preferences.lastContentButtonPushed.value == "chartsButton" && preferences.selectedSymbol.value && preferences.lastChartRange.value == "1d" )
		generateChart( "1d", true );
}

// -------------------------------------------------------------------------------------------

function generateChart( range, dontRenderCache )
{
	preferences.lastChartRange.value = range;

	var symbol = preferences.selectedSymbol.value;

	if( symbol != "" )
	{
		var currentChart = chartsPanel.firstChild;

		var dimLevel = ( currentChart.frameType == "text" ) ? 0 : 50;

		// Dim out existing chart and give notice
		
		var anim = [];
		
		var chartItem = currentChart.firstChild;
		
		while( chartItem )
		{
			anim.push( new FadeAnimation( chartItem, dimLevel, gChartFadeTransition, animator.kEaseOut ) );
			chartItem = chartItem.nextSibling;
		}
	
		var text = new ChartMessage( currentChart );
		text.opacity = 0;
		text.data = "Loading Chart";
		currentChart.appendChild( text );
	
		anim.push( new FadeAnimation( text, 255, gChartFadeTransition, animator.kEaseOut ) );
	
		animator.runUntilDone( anim );
	
		// Check for cached data
		var result = financeDB.query( "SELECT * FROM chart WHERE symbol = '" + symbol + "' AND range = '" + range + "'" );
		var results = result.getAll( );
	
		var nowDate = new Date( );
		var nowTime = Date.parse( nowDate );
	
		if( results.length == 0 )
			var cachedDate = new Date( 0 );
		else
			var cachedDate = new Date( Number( results[0]["timestamp"] ) );
		
		var nowTimestamp = nowDate.getFullYear( ) + "-" + nowDate.getMonth( ) + "-" + nowDate.getDate( );
		var cachedTimestamp = cachedDate.getFullYear( ) + "-" + cachedDate.getMonth( ) + "-" + cachedDate.getDate( );
	
		if( results.length == 0 ||
			( results[0]["range"] == "1d" && nowTime >= Number( results[0]["timestamp"] ) + cOneHourMS ) ||
			( results[0]["range"] != "1d" && nowTimestamp != cachedTimestamp )
		)
		{
			financeDB.query( "DELETE FROM chart WHERE symbol = '" + symbol + "' AND range = '" + range + "'" );
	
			var url = new URL();
			url.timeout = 15;
			url.symbol = symbol;
			url.range = range;
		
			url.location = "http://chartapi.finance.yahoo.com/instrument/1.0/" + escape( symbol ) + "/chartdata;type=quote;range=" + range;

			url.fetchAsync( chartDataComplete );
		}
		else if( !dontRenderCache )
		{
			try
			{
				var chartDOM = XMLDOM.parse( results[0]["storedXML"] );
			}
			catch( e )
			{
				// Failed
				
				var chartDOM = null;
			}
			
			renderChart( chartDOM );
		}
		else // Not rendering a chart, so restore the display
		{
			var anim = [];
			
			var chartItem = currentChart.firstChild;
			
			while( chartItem )
			{
				if( chartItem != text )
					anim.push( new FadeAnimation( chartItem, 255, gChartFadeTransition, animator.kEaseOut ) );

				chartItem = chartItem.nextSibling;
			}

			anim.push( new FadeAnimation( text, 0, gChartFadeTransition, animator.kEaseOut ) );
			
			animator.runUntilDone( anim );
		
			currentChart.removeChild( text );
		}
	}
}

// -------------------------------------------------------------------------------------------

function grabberDown( )
{
	this.clickOffsetV = system.event.y;
	this.upperContentScrollbarVisible = upperContentScrollbar.visible;
}

// -------------------------------------------------------------------------------------------

function grabberDrag( )
{
	// Footer height: 39
	// Header height: 33

	var newHeight = system.event.vOffset - this.clickOffsetV + 29;
	
	var minHeight = footer.height + header.height + lastUpdatedBar.height + ( gExpandedViewHeight * preferences.expandedView.value ) + 20;
	
	if( newHeight < minHeight )
		newHeight = minHeight;
	
	sizeWindow( newHeight );
	
	if( this.upperContentScrollbarVisible != upperContentScrollbar.visible )
	{
		this.upperContentScrollbarVisible = upperContentScrollbar.visible;
		updateStockTextPosition( );
	}
}

// -------------------------------------------------------------------------------------------

function grabberUp( )
{
	preferences.windowHeight.value = mainWindow.height;

	gLastPosition = gCollapsedPosition = gBumpStamp = null;

	if( this.upperContentScrollbarVisible != upperContentScrollbar.visible )
		updateStockTextPosition( );
}

// -------------------------------------------------------------------------------------------

function initWidgetDB( )
{
	financeDB = new SQLite( );
	financeDB.open( system.widgetDataFolder + "/bart.db" );

	try
	{
		financeDB.exec( "CREATE TABLE IF NOT EXISTS chart ( symbol TEXT, range TEXT, timestamp TEXT, storedXML TEXT )" );
		financeDB.exec( "CREATE TABLE IF NOT EXISTS quotes ( symbol TEXT, fullName TEXT, timestamp TEXT, lasttrade REAL, change REAL, changePercent REAL, link TEXT, sortkey INTEGER PRIMARY KEY AUTOINCREMENT )" );
		financeDB.exec( "CREATE TABLE IF NOT EXISTS news ( symbol TEXT, timestamp TEXT, lastBuildDate TEXT, storedXML TEXT )" );

		if( preferences.version.value != "1" )
		{
			var tempNews = filesystem.readFile( "news.rss" );

			if( true ) // Import prefs Stock Ticker Widget, which we're not, so never fire the else
			{
				// Create default prefs
		
				financeDB.exec( "INSERT INTO quotes ( symbol, fullName, timestamp, lasttrade, change, changePercent ) VALUES ( '^DJI', 'DOW JONES INDUSTRIAL AVERAGE', 0, 0, 0, 0 )" );
				financeDB.exec( "INSERT INTO quotes ( symbol, fullName, timestamp, lasttrade, change, changePercent ) VALUES ( '^IXIC', 'NASDAQ COMPOSITE', 0, 0, 0, 0 )" );
				financeDB.exec( "INSERT INTO quotes ( symbol, fullName, timestamp, lasttrade, change, changePercent ) VALUES ( '^GSPC', 'S&P 500 INDEX', 0, 0, 0, 0 )" );
				financeDB.exec( "INSERT INTO quotes ( symbol, fullName, timestamp, lasttrade, change, changePercent ) VALUES ( 'GE', 'GENERAL ELECTRIC CO.', 0, 0, 0, 0 )" );
				financeDB.exec( "INSERT INTO quotes ( symbol, fullName, timestamp, lasttrade, change, changePercent ) VALUES ( 'T', 'AT&T INC.', 0, 0, 0, 0 )" );
				financeDB.exec( "INSERT INTO quotes ( symbol, fullName, timestamp, lasttrade, change, changePercent ) VALUES ( 'MCD', 'MCDONALD''S CORP.', 0, 0, 0, 0 )" );
				financeDB.exec( "INSERT INTO quotes ( symbol, fullName, timestamp, lasttrade, change, changePercent ) VALUES ( 'YHOO', 'YAHOO!, INC.', 0, 0, 0, 0 )" );
	
				financeDB.exec( "INSERT INTO news VALUES ( '^DJI', 0, 0, '" + sqlEscape( tempNews ) + "' )" );
				financeDB.exec( "INSERT INTO news VALUES ( '^IXIC', 0, 0, '" + sqlEscape( tempNews ) + "' )" );
				financeDB.exec( "INSERT INTO news VALUES ( '^GSPC', 0, 0, '" + sqlEscape( tempNews ) + "' )" );
				financeDB.exec( "INSERT INTO news VALUES ( 'GE', 0, 0, '" + sqlEscape( tempNews ) + "' )" );
				financeDB.exec( "INSERT INTO news VALUES ( 'T', 0, 0, '" + sqlEscape( tempNews ) + "' )" );
				financeDB.exec( "INSERT INTO news VALUES ( 'MCD', 0, 0, '" + sqlEscape( tempNews ) + "' )" );
				financeDB.exec( "INSERT INTO news VALUES ( 'YHOO', 0, 0, '" + sqlEscape( tempNews ) + "' )" );
			}
			else
			{
				// Import previous prefs
				
				var symbolList = preferences.userSymbolsPreference.value.split( "*b*" );
				
				for( var i = 0; i < symbolList.length; i++ )
				{
					var symbol		= symbolList[i].split( "*a*" )[0];
					var symbolName	= symbolList[i].split( "*a*" )[1];
				
					financeDB.exec( "INSERT INTO quotes ( symbol, fullName, timestamp, lasttrade, change, changePercent ) VALUES ( '" + sqlEscape( symbol ) + "', '" + sqlEscape( symbolName ).toUpperCase( ) + "', 0, 0, 0, 0 )" );
					financeDB.exec( "INSERT INTO news VALUES ( '" + sqlEscape( symbol ) + "', 0, 0, '" + sqlEscape( tempNews ) + "' )" );
				}
			}

			preferences.version.value = "1";
		}
	}
	catch( e )
	{
		log( e );
		alert( "Error: Unable to create finance database." );
	}
}

// -------------------------------------------------------------------------------------------

function initWidgetFunctions( )
{
	widget.onWillChangePreferences = function( )
	{
		oldPrefs = [ ];
		
		for( var i in preferences )
			oldPrefs[ i ] = preferences[ i ].value;
	}

	widget.onPreferencesChanged = function( )
	{
		if( preferences.precision.value != oldPrefs["precision"] )
			updateStockDisplay( );
		
		if( preferences.tooltips.value != oldPrefs["tooltips"] )
		{
			var nodes = mainWindow.firstChild.evaluate( "//*[@tooltip]" );

			if( preferences.tooltips.value == 1 )
				for( var i = 0; i < nodes.length; i++ )
					nodes.item( i ).tooltip = nodes.item( i ).sTooltip;
			else
				for( var i = 0; i < nodes.length; i++ )
					nodes.item( i ).tooltip = "";
		}
	}
	
	widget.onDockClosed = function( )
	{
		dockTimer.ticking = false;
	}
	
	widget.onDockOpened = function( )
	{
		gDockIndex = -2;
		rotateDock( );
		dockTimer.ticking = true;
	}
}

// -------------------------------------------------------------------------------------------

function initWidgetWindow( )
{
	lowerContent.height = chartsPanelLowerShadow.vOffset = gExpandedViewHeight * preferences.expandedView.value;

	sizeWindow( preferences.windowHeight.value );

	upperContentScrollbar.setThumbInfo( 0, ["Resources/UI/Scrollbar/Thumb/Top Cap.png", "Resources/UI/Scrollbar/Thumb/Middle.png", "Resources/UI/Scrollbar/Thumb/Bottom Cap.png"] );
	upperContentScrollbar.setTrackInfo( 0, 0, 0, ["Resources/UI/Scrollbar/Track/Top Cap.png", "Resources/UI/Scrollbar/Track/Middle.png", "Resources/UI/Scrollbar/Track/Bottom Cap.png"] );

	upperContent.vScrollBar = upperContentScrollbar;

	// Set up footer buttons

	// #/% button

	var icon = new Image( );
	if( preferences.displayPercentageValues.value == 1 )
		icon.src = "Resources/UI/Button Icons/Number.png";
	else
		icon.src = "Resources/UI/Button Icons/Percent.png";

	var button = new UIbasicButton( );
	button.hOffset = 18;
	button.vOffset = 8;
	button.onClick = toggleNumberDisplay;
	button.appendChild( icon );
	footer.appendChild( button );
	if( preferences.displayPercentageValues.value == 1 )
		setTooltip( button, "Show monetary change" );
	else
		setTooltip( button, "Show percentage change" );

	// Chart button
	
	var icon = new Image( );
	icon.src = "Resources/UI/Button Icons/Chart.png";

	var button = new UIbasicButton( );
	button.toggle = true;
	button.id = "chartsButton";
	button.hOffset = 43;
	button.vOffset = 8;
	button.onClick = toggleLowerContentDisplay;
	button.appendChild( icon );
	footer.appendChild( button );
	setTooltip( button, "Show chart and news" );
	var chartsButton = button;

	// Add/edit button

	var icon = new Image( );
	icon.src = "Resources/UI/Button Icons/Add.png";

	var button = new UIbasicButton( );
	button.toggle = true;
	button.id = "searchButton";
	button.hOffset = 68;
	button.vOffset = 8;
	button.onClick = toggleLowerContentDisplay;
	button.appendChild( icon );
	footer.appendChild( button );
	setTooltip( button, "Add/edit symbols" );
	var searchButton = button;

	// Set up chart buttons

	var button = new UIbasicButton( );
	button.id = "stockRange1d";
	button.hOffset = 39;
	button.vOffset = 38;
	button.text.data = "1d";
	button.toggle = true;
	button.onClick = function( ) { if( preferences.lastChartRange.value != "1d" ) generateChart( "1d" ) };
	chartsPanel.appendChild( button );
	setTooltip( button, "Show one-day chart" );

	var button = new UIbasicButton( );
	button.id = "stockRange7d";
	button.hOffset = 64;
	button.vOffset = 38;
	button.text.data = "1w";
	button.toggle = true;
	button.onClick = function( ) { if( preferences.lastChartRange.value != "7d" ) generateChart( "7d" ) };
	chartsPanel.appendChild( button );
	setTooltip( button, "Show one-week chart" );
	
	var button = new UIbasicButton( );
	button.id = "stockRange1m";
	button.hOffset = 89;
	button.vOffset = 38;
	button.text.data = "1m";
	button.toggle = true;
	button.onClick = function( ) { if( preferences.lastChartRange.value != "1m" ) generateChart( "1m" ) };
	chartsPanel.appendChild( button );
	setTooltip( button, "Show one-month chart" );
	
	var button = new UIbasicButton( );
	button.id = "stockRange3m";
	button.hOffset = 114;
	button.vOffset = 38;
	button.text.data = "3m";
	button.toggle = true;
	button.onClick = function( ) { if( preferences.lastChartRange.value != "3m" ) generateChart( "3m" ) };
	chartsPanel.appendChild( button );
	setTooltip( button, "Show three-month chart" );
	
	var button = new UIbasicButton( );
	button.id = "stockRange6m";
	button.hOffset = 139;
	button.vOffset = 38;
	button.text.data = "6m";
	button.toggle = true;
	button.onClick = function( ) { if( preferences.lastChartRange.value != "6m" ) generateChart( "6m" ) };
	chartsPanel.appendChild( button );
	setTooltip( button, "Show six-month chart" );
	
	var button = new UIbasicButton( );
	button.id = "stockRange1y";
	button.hOffset = 164;
	button.vOffset = 38;
	button.text.data = "1y";
	button.toggle = true;
	button.onClick = function( ) { if( preferences.lastChartRange.value != "1y" ) generateChart( "1y" ) };
	chartsPanel.appendChild( button );
	setTooltip( button, "Show one-year chart" );
	
	var button = new UIbasicButton( );
	button.id = "stockRange2y";
	button.hOffset = 189;
	button.vOffset = 38;
	button.text.data = "2y";
	button.toggle = true;
	button.onClick = function( ) { if( preferences.lastChartRange.value != "2y" ) generateChart( "2y" ) };
	chartsPanel.appendChild( button );
	setTooltip( button, "Show two-year chart" );

	chartsPanelLowerShadow.orderAbove( );

	// Set up search panel

	// Search Field

	var focusImage = new Image( );
	focusImage.id = "searchFieldFocus";
	focusImage.src = "Resources/UI/Search Field Focus.png";
	focusImage.visible = false;
	focusImage.hOffset = 6;
	focusImage.vOffset = 19;
	searchPanel.appendChild( focusImage );

	var label = new StyledText( "form" );
	label.data = "Company Name or Symbol";
	label.hOffset = 9;
	label.vOffset = 16;
	searchPanel.appendChild( label );
	
	var fieldImage = new Image( );
	fieldImage.src = "Resources/UI/Search Field.png";
	fieldImage.hOffset = 10;
	fieldImage.vOffset = 22;
	searchPanel.appendChild( fieldImage );

	var searchField = new TextArea( );
	searchField.id = "searchField";
	searchField.hOffset = 11;
	searchField.vOffset = 25;
	searchField.width = 200;
	searchField.style.fontFamily = "Helvetica, Arial";
	searchField.style.fontSize = "12px";
	searchField.style.color = gInactiveTextColor;
	searchField.lines = 1;
	searchField.editable = true;
	searchField.scrollbar = false;
	searchField.data = "Search";
	searchPanel.appendChild( searchField );

	searchField.onGainFocus = function( )
	{
		if( this.style.color == gInactiveTextColor )
		{
			this.data = "";
			this.style.color = "#000000";
		}
	
		searchPanel.getElementById( "searchFieldFocus" ).visible = true;
	}

	searchField.onLoseFocus = function( )
	{
		if( this.data.replace( /[ \r\n\t]/g, "" ) == "" )
		{
			this.data = "Search";
			this.style.color = gInactiveTextColor;
		}

		searchPanel.getElementById( "searchFieldFocus" ).visible = false;
	}

	searchField.onKeyPress = function( )
	{
		if( system.event.keyString == "Return" || system.event.keyString == "Enter" || system.event.keyString == "Tab" )
			this.rejectKeyPress( );

		if( system.event.keyString == "Return" || system.event.keyString == "Enter" )
		{
			this.loseFocus( );
			searchForSymbol( );
		}
	}

	// Search button

	var button = new UIbasicButton( );
	button.id = "symbolSearchButton";
	button.hOffset = 214;
	button.vOffset = 22;
	button.width = 28;
	button.firstChild.src = "Resources/UI/Search Button 0.png"
	button.onClick = searchForSymbol;
	searchPanel.appendChild( button );
	if( system.platform == "macintosh" )
		setTooltip( button, "Click or press Return to search" );
	else
		setTooltip( button, "Click or press Enter to search" );

	// Search Type popup

	var label = new StyledText( "form" );
	label.data = "Search Type";
	label.hOffset = 10;
	label.vOffset = 64;
	searchPanel.appendChild( label );
	
	var popup = new UIpopup( );
	popup.id = "searchTypePopup";
	popup.hOffset = 9;
	popup.vOffset = 70;
	popup.setWidth( 115 );
	popup.setLabel( "Stocks" );
	searchPanel.appendChild( popup );

	var item = new MenuItem( );
	item.title = "Stocks";
	item.onSelect = setPopupToSelection;
	item.parentFrame = popup;
	item._selectName = popup._selectName = "S";
	popup.menuArray.push( item );

	var item = new MenuItem( );
	item.title = "ETF";
	item.onSelect = setPopupToSelection;
	item.parentFrame = popup;
	item._selectName = "E";
	popup.menuArray.push( item );

	var item = new MenuItem( );
	item.title = "Indices";
	item.onSelect = setPopupToSelection;
	item.parentFrame = popup;
	item._selectName = "I";
	popup.menuArray.push( item );

	var item = new MenuItem( );
	item.title = "Mutual Fund";
	item.onSelect = setPopupToSelection;
	item.parentFrame = popup;
	item._selectName = "M";
	popup.menuArray.push( item );

	// Market popup

	var label = new StyledText( "form" );
	label.data = "Market";
	label.hOffset = 129;
	label.vOffset = 64;
	searchPanel.appendChild( label );

	var popup = new UIpopup( );
	popup.id = "marketTypePopup";
	popup.hOffset = 128;
	popup.vOffset = 70;
	popup.setWidth( 115 );
	popup.setLabel( "US & Canada" );
	searchPanel.appendChild( popup );

	var item = new MenuItem( );
	item.title = "US & Canada";
	item.onSelect = setPopupToSelection;
	item.parentFrame = popup;
	item._selectName = popup._selectName = "US";
	popup.menuArray.push( item );

	var item = new MenuItem( );
	item.title = "All Markets";
	item.onSelect = setPopupToSelection;
	item.parentFrame = popup;
	item._selectName = "ALL";
	popup.menuArray.push( item );

	// Search Results popup

	var label = new StyledText( "form" );
	label.data = "Search Results";
	label.hOffset = 21;
	label.vOffset = 126;
	searchPanel.appendChild( label );

	var popup = new UIpopup( );
	popup.id = "searchResults";
	popup.hOffset = 20;
	popup.vOffset = 131;
	popup.setWidth( 215 );
	popup.setLabel( gDefaultSearchLabel );
	popup.setActive( false );
	searchPanel.appendChild( popup );

	// Add button

	var button = new UIbutton( );
	button.id = "addButton";
	button.hOffset = 181;
	button.vOffset = 159;
	button.setLabel( "Add" );
	button.setWidth( 54 );
	button.setActive( false );
	searchPanel.appendChild( button );
	setTooltip( button, "Add symbol to list" );

	button.onClick = function( )
	{
		if( this.active )
			addSymbol( );
	}

	// Set up drag scroll timer
	
	dragTimer.scrollOffset = 0;
	dragTimer.onTimerFired = function( )
	{
		upperContentScrollbar.value += this.scrollOffset;
	}

	// Set up quote update timer

	quoteUpdateTimer.onTimerFired = getQuotes;
	quoteUpdateTimer.ticking = true;

	// Set up news update timer

	newsUpdateTimer.onTimerFired = getNews;

	// Set up news rotate timer

	newsTimer.onTimerFired = rotateNews;

	// Set up news mouseover delay timer
	
	newsPauseTimer.onTimerFired = function( )
	{
		newsTimer.ticking = false;
	}

	// Set up dock update timer

	dockTimer.onTimerFired = rotateDock;

	// Restore Widget display

	if( preferences.lastContentButtonPushed.value != "" )
	{
		lowerContent.getElementById( preferences.lastContentButtonPushed.value.substr( 0, 6 ) + "Panel" ).opacity = 255;
		
		var pushedButton = footer.getElementById( preferences.lastContentButtonPushed.value );
		pushedButton.selected = true;
		pushedButton.firstChild.src = pushedButton.firstChild.src.replace( /0/, "1");
		pushedButton.lastChild.colorize = gBtnIconSelectedColor;
	}

	var pushedButton = chartsPanel.getElementById( "stockRange" + preferences.lastChartRange.value );
	pushedButton.selected = true;
	pushedButton.firstChild.src = pushedButton.firstChild.src.replace( /0/, "1");
	pushedButton.text.style.color = gBtnIconSelectedColor;

	lastUpdatedBar.lastChild.data = preferences.lastUpdated.value;

	if( preferences.lastContentButtonPushed.value == "searchButton" )
	{
		upperContent.hOffset = -244;
		setTooltip( searchButton, "Save changes to symbols" );
		setTooltip( chartsButton, "Save changes to symbols and show chart" );
	}

	mainWindow.visible = true;

	gNewsDOM = gDefaultNewsDOM;
	gCurrentNewsNode = gNewsDOM.evaluate( "rss/channel/item" ).item( 0 );
	rotateNews( );

	updateStockDisplay( );

	if( preferences.lastContentButtonPushed.value == "chartsButton" && upperContent.firstChild )
	{
		if( preferences.selectedSymbol.value == "" )
			preferences.selectedSymbol.value = upperContent.firstChild.symbol;
		
		var button = footer.getElementById( "chartsButton" );
		setTooltip( button, "Hide chart and news" );
		
		// Some of stockLineSelected( ) replicated here
		
		generateChart( preferences.lastChartRange.value )
		
		// Also reset the news, start the timers if they're not already
		newsTimer.reset( );
		newsUpdateTimer.reset( );
		newsTimer.ticking = true;
		newsUpdateTimer.ticking = true;
		getNews( );
	}
	else
	{
		clearChartsPanel( );
	}

	getQuotes( );

	rotateDock( );

	dockTimer.ticking = true;
}

// -------------------------------------------------------------------------------------------

function NewsLine( )
{
	var obj = new Frame( );
	obj.link = null;
	
	obj.width = 488;
	obj.height = 31;

	obj.style.fontFamily = "Helvetica, Arial";
	obj.style.fontWeight = "bold";
	obj.style.fontSize = "12px";
	obj.style.color = "#6D6B67";
	obj.style.background = "url( 'Resources/Window/News Background.png' ) no-repeat";

	obj.type = new Text( );
	obj.type.hOffset = 8;
	obj.type.vOffset = 17;
	obj.type.style.fontSize = "9px";
	obj.appendChild( obj.type );

	obj.text = new Text( );
	obj.text.hOffset = 44;
	obj.text.vOffset = 18;
	obj.text.width = 190;
	obj.text.style.KonTextTruncation = "end";
	obj.appendChild( obj.text );

	obj.onClick = function( )
	{
		if( this.link )
		{
			newsTimer.ticking = true;
			openURL( this.link );
		}
	}

	obj.onMouseEnter = function( )
	{
		newsPauseTimer.ticking = true;
	}

	obj.onMouseExit = function( )
	{
		newsPauseTimer.ticking = false;
		newsTimer.ticking = true;
	}

	return obj;
}

// -------------------------------------------------------------------------------------------

function parseChartLabel( type, data )
{
	if( type == "Timestamp" )
	{
		var parsedData;
		var date = new Date( data * 1000 );
		var hour = Number( date.getHours( ) );
		if( hour == 0 )
			parsedData = 12;
		else
			parsedData = ( hour <= 12 ) ? hour : hour - 12;
		
		parsedData += ":";
		parsedData += ( "0" + date.getMinutes( ) ).substr( -0, 2 );

		return parsedData;
	}
	else if( type == "Date" )
	{
		var parsedData = Number( data.substr( 4, 2 ) );
		parsedData += "/";
		parsedData += data.substr( 6, 2 );
		parsedData += "/";
		parsedData += data.substr( 2, 2 );

		return parsedData;
	}
	else
	{
		return 0
	}
}

// -------------------------------------------------------------------------------------------

function renderChart( chartDOM )
{
	var currentChart = chartsPanel.firstChild;

	var chartFrame = new Frame( );
	chartFrame.width = 244;
	chartFrame.height = 119;
	chartFrame.hOffset = 6;
	chartFrame.vOffset = 77;
	chartFrame.opacity = 0;

	var chartWidth = 206;
	var chartHeight = 94;
	
	var chartCanvas = new Canvas( );
	chartCanvas.hOffset = 6;
	chartCanvas.vOffset = 6;
	
	chartFrame.appendChild( chartCanvas );

	var symbol = new Text( );
	symbol.style.fontFamily = "'Arial Black'";
	symbol.style.fontSize = "26px";
	symbol.style.color = "rgba( 135, 135, 135, 0.25 )";
	symbol.hOffset = 12;
	symbol.vOffset = 20;
	symbol.data = preferences.selectedSymbol.value;
	chartFrame.appendChild( symbol );

	var closeMin = Number( chartDOM.evaluate( "string( data-series/series/values/value[@id='close']/min )" ) );
	var closeMax = Number( chartDOM.evaluate( "string( data-series/series/values/value[@id='close']/max )" ) );
	
	var chartPoints = chartDOM.evaluate( "data-series/series/p" );
	
	if( chartPoints.length > 1 )
	{
		// Y-axis labels
		
		var labelPrecision = 0;
		
		if( closeMax < 1 )
			labelPrecision = 4;
		else if( closeMax < 10 )
			labelPrecision = 3;
		else if( closeMax < 100 )
			labelPrecision = 2;
		else if( closeMax < 1000 )
			labelPrecision = 1;
		else
			labelPrecision = 0;
		
		var minText = new StyledText( "chart" );
		minText.hAlign = "right";
		minText.hOffset = chartFrame.width - 6;
		minText.vOffset = chartCanvas.vOffset + chartHeight + 3;
		minText.data = closeMin.toFixed( labelPrecision );
		chartFrame.appendChild( minText );
		
		var maxText = new StyledText( "chart" );
		maxText.hAlign = "right";
		maxText.hOffset = chartFrame.width - 6;
		maxText.vOffset = chartCanvas.vOffset + 3;
		maxText.data = closeMax.toFixed( labelPrecision );
		chartFrame.appendChild( maxText );
		
		chartWidth = chartFrame.width - maxText.width - 6 - 6 - 6;
		
		var yLabelValueStep = ( closeMax - closeMin ) / 6;
		var yLabelVOffsetStep = chartHeight / 6;
		
		for( var i = 1; i < 6; i++ )
		{
			var text = new StyledText( "chart" );
			text.hAlign = "right";
			text.hOffset = chartFrame.width - 6;
			text.vOffset = chartCanvas.vOffset + ( yLabelVOffsetStep * i ) + 3;
			text.data = ( closeMax - ( yLabelValueStep * i ) ).toFixed( labelPrecision );
			chartFrame.appendChild( text );
		}
		
		// Generate the chart
		
		chartCanvas.width = chartWidth;
		chartCanvas.height = chartHeight;
		
		var activityRange = closeMax - closeMin;
		
		var yMultiplier = chartCanvas.height / activityRange;
		var points = [];
		var point = [];
		
		var ctx = chartCanvas.getContext( "2d" );
		
		ctx.strokeStyle = "rgba( 0, 0, 0, 0.6 )";
		ctx.lineWidth = 1;
		
		var labelTotal = 3;
		var xInc = chartWidth / ( chartPoints.length - 1 );
		var x = 0;
		var xAxisStep = Math.floor( chartPoints.length / labelTotal );
		var xLabelType = chartDOM.evaluate( "string( data-series/reference-meta/type )" );
		var labelCount = 0;
	
		for( var i = 0; i < chartPoints.length; i++ )
		{
			var yValue = chartHeight - ( ( chartPoints.item(i).firstChild.firstChild.data - closeMin ) * yMultiplier );
		
			point = [];
			point.x = x;
			point.y = yValue;
			points.push( point );
		
			if( !( i % xAxisStep ) && labelCount < labelTotal )
			{
				labelCount ++;
			
				ctx.beginPath( );
				ctx.moveTo( Math.floor( x ) + 0.5, 0 );
				ctx.lineTo( Math.floor( x ) + 0.5, chartHeight );
				ctx.stroke( );
		
				var ref = chartPoints.item( i ).getAttribute( "ref" );
			
				var text = new StyledText( "chart" );
				text.hAlign = ( i == 0 ) ? "left" : "center";
				text.hOffset = chartCanvas.hOffset + x;
				text.vOffset = chartCanvas.vOffset + chartHeight + 12;
				text.data = parseChartLabel( xLabelType, ref  );
				chartFrame.appendChild( text );
			}
		
			x += xInc;
		}
		
		x -= xInc;
		
		var ref = chartPoints.item( i - 1 ).getAttribute( "ref" );
		
		var text = new StyledText( "chart" );
		text.hAlign = "right";
		text.hOffset = chartCanvas.hOffset + x;
		text.vOffset = chartCanvas.vOffset + chartHeight + 12;
		text.data = parseChartLabel( xLabelType, ref  );
		chartFrame.appendChild( text );
	
		ctx.globalCompositeOperation = "destination-atop";
	
		for( var i = 0; i < points.length; i++ )
		{
			if( i == 0 )
			{
				ctx.beginPath( );
				ctx.moveTo( 0, chartHeight );
				ctx.lineTo( 0, points[i].y );
			}
			else
			{
				ctx.lineTo( points[i].x, points[i].y );
			}
		}
		
		ctx.lineTo( x, chartHeight );
		ctx.lineTo( 0, chartHeight );
		
		ctx.fillStyle = "rgba( 128, 126, 122, 1.0 )";
		ctx.fill( );

		ctx.globalCompositeOperation = "destination-out";
		
		var grad = ctx.createLinearGradient( 0, 0, 0, chartHeight );

		grad.addColorStop( 0, "rgba( 0, 0, 0, 1.0 )" );
		grad.addColorStop( 1.0, "rgba( 0, 0, 0, 0.4 )" );
		
		ctx.fillStyle = grad;
		ctx.fillRect( 0, 0, chartWidth, chartHeight );



		ctx.globalCompositeOperation = "source-atop";
	
		ctx.strokeStyle = "rgba( 0, 0, 0, 0.6 )";
		ctx.lineWidth = 1;
	
		for( var i = 1; i < 6; i++ )
		{
			var yPos = Math.floor( i * yLabelVOffsetStep ) + 0.5;
		
			ctx.beginPath( );
			ctx.moveTo( 0, yPos );
			ctx.lineTo( chartWidth, yPos );
			ctx.stroke( );
		}
	
		ctx.lineWidth = 2;
		ctx.beginPath( );
		ctx.moveTo( 0, chartHeight );
		ctx.lineTo( chartWidth, chartHeight );
		ctx.lineTo( chartWidth, 0 );
		ctx.stroke( );
	
		ctx.globalCompositeOperation = "source-over";
	
		ctx.lineWidth = 2;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";

		ctx.save( );
		
		ctx.translate( 0, 2 );
		ctx.beginPath( );
		ctx.moveTo( points[0].x, points[0].y );
		
		for( var i = 1; i < points.length; i++ )
			ctx.lineTo( points[i].x, points[i].y );
		
		ctx.strokeStyle = "rgba( 0, 0, 0, 0.18)";
		ctx.stroke( );

		ctx.restore( );

		ctx.beginPath( );
		ctx.moveTo( points[0].x, points[0].y );
		
		for( var i = 1; i < points.length; i++ )
			ctx.lineTo( points[i].x, points[i].y );

		ctx.strokeStyle = "#C4240B";
		ctx.stroke( );
	}
	else // No chart data
	{
		var text = new ChartMessage( chartFrame );
		text.data = "No Chart Data Available";
		chartFrame.frameType = "text";
		chartFrame.appendChild( text );
	}
	
	chartsPanel.appendChild( chartFrame );
	
	var anim = [];
	
	anim.push( new FadeAnimation( currentChart, 0, gChartFadeTransition, animator.kEaseOut ) );
	anim.push( new FadeAnimation( chartFrame, 255, gChartFadeTransition, animator.kEaseOut ) );
	
	animator.runUntilDone( anim );

	chartsPanel.removeChild( currentChart );

	chartFrame.orderBelow( );
}

// -------------------------------------------------------------------------------------------

function returnFullIndexName( abbrevIndex )
{
	var theIndex = abbrevIndex;

	switch( abbrevIndex )
	{
		case "AMS": theIndex = "Amsterdam Exchange"; break
		case "ASE": theIndex = "AMEX"; break
		case "ASQ": theIndex = "AMEX Consolidated Issue"; break
		case "ASX": theIndex = "Australian Exchange"; break
		case "BER": theIndex = "Berlin Exchange"; break
		case "BRU": theIndex = "Brussels Exchange"; break
		case "BSE": theIndex = "Bombay Exchange"; break
		case "BUE": theIndex = "Buenos Aires Exchange"; break
		case "CPH": theIndex = "Copenhagen Exchange"; break
		case "DJI": theIndex = "Dow Jones Indicies"; break
		case "DUS": theIndex = "Dusseldorf Exchange"; break
		case "FRA": theIndex = "Frankfurt Exchange"; break
		case "FRF": theIndex = "French Mutual Funds"; break
		case "FSI": theIndex = "FTSE International (Indices)"; break
		case "GER": theIndex = "Xetra Exchange"; break
		case "HAM": theIndex = "Hamburg Exchange"; break
		case "HKG": theIndex = "Hong Kong Exchange"; break
		case "IND": theIndex = "Indices"; break
		case "JKT": theIndex = "Jakarta Exchange"; break
		case "KBT": theIndex = "Kansas City Board of Trade"; break
		case "KLS": theIndex = "Kuala Lumpur Exchange"; break
		case "KOE": theIndex = "KOSDAQ"; break
		case "KSC": theIndex = "Korea Exchange (KOSCOM)"; break
		case "LSE": theIndex = "London Exchange"; break
		case "MAD": theIndex = "Madrid Exchange"; break
		case "MCE": theIndex = "Madrid Exchange CATS"; break
		case "MEX": theIndex = "Mexican Exchange"; break
		case "MIL": theIndex = "Milan Exchange"; break
		case "MUN": theIndex = "Munich Exchange"; break
		case "NAS": theIndex = "Nasdaq"; break
		case "NMS": theIndex = "Nasdaq"; break
		case "NSI": theIndex = "National Stock Exchange of India"; break
		case "NYQ": theIndex = "NYSE Consolidated Issue"; break
		case "NYS": theIndex = "NYSE"; break
		case "OBB": theIndex = "OTC Bulletin Board Market"; break
		case "OPR": theIndex = "OPRA Options"; break
		case "OSL": theIndex = "Oslo Exchange"; break
		case "PAR": theIndex = "Paris Exchange"; break
		case "PHO": theIndex = "Philadelphia Options"; break
		case "PNK": theIndex = "OTC Pink Sheet"; break
		case "SAO": theIndex = "Sao Paulo Exchange"; break
		case "SES": theIndex = "Singapore Exchange"; break
		case "SET": theIndex = "Thai Exchange"; break
		case "SHH": theIndex = "Shanghai Exchange"; break
		case "SOM": theIndex = "Swedish Options"; break
		case "STO": theIndex = "Stockholm Exchange"; break
		case "STU": theIndex = "Stuttgart Exchange"; break
		case "TAI": theIndex = "Taiwan Exchange"; break
		case "TLV": theIndex = "Tel Aviv Exchange"; break
		case "TOR": theIndex = "Toronto Exchange"; break
		case "TWO": theIndex = "Taiwan OTC Exchange"; break
		case "VAN": theIndex = "Canadian Venture Exchange"; break
		case "VTX": theIndex = "Virtual X"; break
		case "ZRH": theIndex = "Zurich Exchange"; break
	}
	return theIndex;
}

// -------------------------------------------------------------------------------------------

function rotateDock( resetDB )
{
	// gDockIndex = -2 is a flag to reload 

	var dockStockName = vitalityDoc.getElementById( "dockStockName" );
	var dockStockSymbol = vitalityDoc.getElementById( "dockStockSymbol" );
	var dockStockDelta = vitalityDoc.getElementById( "dockStockDelta" );
	var dockDirectionBackground = vitalityDoc.getElementById( "dockDirectionBackground" );
	var dockDirectionIndicator = vitalityDoc.getElementById( "dockDirectionIndicator" );

	if( gDockIndex == -2 )
	{
		var result = financeDB.query( "SELECT * FROM quotes ORDER BY sortkey" );
		gDockData = result.getAll( );
		result.dispose( );
		gDockIndex = 0;
	}
	else if( resetDB == true )
	{
		var currentSymbol = gDockData[gDockIndex]["symbol"];

		gDockIndex = -1;

		var result = financeDB.query( "SELECT * FROM quotes ORDER BY sortkey" );
		gDockData = result.getAll( );
		result.dispose( );
		
		for( var i = 0; i < gDockData.length; i++ )
			if( gDockData[i]["symbol"] == currentSymbol )
				gDockIndex = i;
	}
	else
	{
		gDockIndex++;

		if( gDockIndex >= gDockData.length )
		{
			gDockIndex = -2;
			rotateDock( );
		}
	}

	if( gDockData.length == 0 )
	{
		dockStockSymbol.setAttribute( "data", "N/A" );
		dockStockName.setAttribute( "data", "No selections" );
		dockStockDelta.setAttribute( "data", "N/A" );
		dockStockDelta.setAttribute( "style", gDockStockDeltaStyle + "; color: #535353" );
		dockDirectionBackground.setAttribute( "src", "Resources/Dock/Background Neutral.png" );
		dockDirectionIndicator.setAttribute( "visible", 0 );
		gDockIndex = -2;

		widget.setDockItem( vitalityDoc, "fade" );
	}
	else if( !resetDB != true )
	{
		dockStockSymbol.setAttribute( "data", gDockData[gDockIndex]["symbol"] );
		dockStockName.setAttribute( "data", gDockData[gDockIndex]["fullName"] );

		if( preferences.displayPercentageValues.value == 1 )
		{
			var stockDelta = gDockData[gDockIndex]["changePercent"];
			dockStockDelta.setAttribute( "data", Math.abs( stockDelta ).toFixed( preferences.precision.value ) + "%" );
		}
		else
		{
			var stockDelta = gDockData[gDockIndex]["change"];
			dockStockDelta.setAttribute( "data", Math.abs( stockDelta ).toFixed( preferences.precision.value ) );
		}

		if( stockDelta < 0 )
		{
			dockStockDelta.setAttribute( "style", gDockStockDeltaStyle + "; color: #770e09" );
			dockDirectionBackground.setAttribute( "src", "Resources/Dock/Background Down.png" );
			dockDirectionIndicator.setAttribute( "src", "Resources/Window/Stock Line/Down Arrow.png" );
			dockDirectionIndicator.setAttribute( "visible", 1 );
		}
		else if( stockDelta > 0 )
		{
			dockStockDelta.setAttribute( "style", gDockStockDeltaStyle + "; color: #2f7800" );
			dockDirectionBackground.setAttribute( "src", "Resources/Dock/Background Up.png" );
			dockDirectionIndicator.setAttribute( "src", "Resources/Window/Stock Line/Up Arrow.png" );
			dockDirectionIndicator.setAttribute( "visible", 1 );
		}
		else
		{
			dockStockDelta.setAttribute( "style", gDockStockDeltaStyle + "; color: #535353" );
			dockDirectionBackground.setAttribute( "src", "Resources/Dock/Background Neutral.png" );
			dockDirectionIndicator.setAttribute( "visible", 0 );
		}

		widget.setDockItem( vitalityDoc, "fade" );
	}
}

// -------------------------------------------------------------------------------------------

function rotateNews( )
{
	var oldNewsLine = newsPanel.firstChild;
	var newNewsLine = new NewsLine( );
	var anim = [];
	var duration = preferences.newsAnimation.value == "1" ? 500 : 0;

	newNewsLine.type.data = "NEWS";


	var newsTitle = gCurrentNewsNode.getElementsByTagName( "title" ).item(0);
	
	if( newsTitle.firstChild )
		newsTitle = newsTitle.firstChild.data;
	else
		newsTitle = "Untitled News";


	var newsDescription = gCurrentNewsNode.getElementsByTagName( "description" ).item(0);

	if( newsDescription.firstChild )
		newsDescription = newsDescription.firstChild.data;
	else
		newsDescription = null;


	var newsLink = gCurrentNewsNode.getElementsByTagName( "link" ).item(0);

	if( newsLink.firstChild )
		newsLink = newsLink.firstChild.data;
	else
		newsLink = "http://finance.yahoo.com";

	
	newNewsLine.text.data = newsTitle;

	if( newsDescription )
		setTooltip( newNewsLine, newsTitle + "\n\n" + newsDescription );
	else
		setTooltip( newNewsLine, newsTitle );
	
	newNewsLine.link = newsLink;

	newNewsLine.vOffset = 28;
	
	newsPanel.appendChild( newNewsLine );

	anim.push( new MoveAnimation( oldNewsLine, 0, 28, duration, animator.kEaseOut ) );
	anim.push( new MoveAnimation( newNewsLine, 0, 0, duration, animator.kEaseOut, rotateNewsComplete ) );
	
	animator.start( anim );
	
	if( !gCurrentNewsNode.nextSibling )
		gCurrentNewsNode = gCurrentNewsNode.parentNode.getElementsByTagName( "item" ).item( 0 );
	else
		gCurrentNewsNode = gCurrentNewsNode.nextSibling;
}

// -------------------------------------------------------------------------------------------

function rotateNewsComplete( )
{
	var newsLine = newsPanel.firstChild;
	
	while( newsLine != newsPanel.lastChild )
	{
		var nextSibling = newsLine.nextSibling;
		newsPanel.removeChild( newsLine );
		newsLine = nextSibling;	
	}
}

// -------------------------------------------------------------------------------------------

function searchForSymbol( )
{
	var searchField = searchPanel.getElementById( "searchField" );

	if( searchField.data.replace( /[ \r\n\t]/g, "" ) == "" || searchField.color == gInactiveTextColor )
		return;
	
	var request = new XMLHttpRequest( );
	
	request.query	= searchField.data;
	request.type	= searchPanel.getElementById( "searchTypePopup" )._selectName;
	request.market	= searchPanel.getElementById( "marketTypePopup" )._selectName;
	
	request.open( "GET", "http://finance.yahoo.com/xml/findsym?s=" + escape( request.query ) + "&t=" + request.type + "&m=" + request.market + "&r=5", true);
	request.onreadystatechange = searchForSymbolComplete;

	showSpinner( true );

	request.send( );
}

// -------------------------------------------------------------------------------------------

function searchForSymbolComplete( )
{
	var popup = searchPanel.getElementById( "searchResults" );
	var addButton = searchPanel.getElementById( "addButton" );

	if( this.readyState == 4 )
	{
		showSpinner( false );

		if( this.status == 200 )
		{
			var doc = this.responseXML;
			
			var numFound = Number( doc.evaluate( "string( page/symLookup/hits/hit[@type='" + this.type + "'] )" ) );
			
			if( numFound == 0 )
			{
				popup.setLabel( gDefaultSearchLabel );
				popup.setActive( false );
				addButton.setActive( false );

				alert( "The company or symbol you were searching for was not found." );
				return;
			}
			else if( numFound > 50 )
			{
				popup.setLabel( gDefaultSearchLabel );
				popup.setActive( false );
				addButton.setActive( false );

				alert( "Your search returned too many items. Please try searching again using more refined terms." );
				return;
			}

			popup.menuArray = [];

			var nodeName = "";
			
			if( this.type == "S" )
				nodeName = "equity";
			else if( this.type == "E" )
				nodeName = "etf";
			else if( this.type == "I" )
				nodeName = "index";
			else if( this.type == "M" )
				nodeName = "mutual";

			var results = doc.evaluate( "page/financialInstruments/" + nodeName );
			var exchangeList = "@@";			
			
			for( var i = 0; i < results.length; i++ )
			{
				var symbol		= results.item( i ).evaluate( "string( symbol )" );
				var exchange	= results.item( i ).evaluate( "string( exchange )" );
				var name		= results.item( i ).evaluate( "string( name/short )" );
			
				if( exchangeList.indexOf( "@@" + exchange + "@@" ) == -1 )
				{
					var item = new MenuItem( );
					item.title = "-";
					item._symbol = "^^^^^^^^^^^^^^^";
					item._exchange = exchange;
					popup.menuArray.push( item );
					
					exchangeList += exchange + "@@";
				}
			
				var item = new MenuItem( );
				item.title = symbol + " - " + name + " (" + returnFullIndexName( exchange ) + ")";
				item.onSelect = setPopupToSelection;
				item.parentFrame = popup;
				item._name = name;
				item._symbol = symbol;
				item._exchange = exchange;
				popup.menuArray.push( item );
			}
			
			popup.menuArray.sort( symbolSort );
			popup.menuArray.pop( ); // Remove the last divider line

			popup._name = popup.menuArray[0]._name;
			popup._symbol = popup.menuArray[0]._symbol;
			popup.setLabel( popup.menuArray[0].title );
			popup.setActive( true );
			addButton.setActive( true );
		}
		else
		{
			popup.setLabel( gDefaultSearchLabel );
			popup.setActive( false );
			addButton.setActive( false );

			alert( "There was a problem fetching your search results.\n\nPlease check your network connection or try searching again later." );
		}
	}
}

// -------------------------------------------------------------------------------------------

function setPopupToSelection( )
{
	this.parentFrame.lastChild.data = this.title;
	
	for( var property in this )
		if( property.charAt( 0 ) == "_" )
			this.parentFrame[property] = this[property];
}

// -------------------------------------------------------------------------------------------

function setTooltip( obj, tipText )
{
	obj.sTooltip = tipText;
	
	if( preferences.tooltips.value == "1" )
		obj.tooltip = tipText;
	else
		obj.tooltip = "";
}

// -------------------------------------------------------------------------------------------

function sqlEscape( a )
{
	if( a )
		return a.replace( /'/g, "''" );
	else
		return "";
}

// -------------------------------------------------------------------------------------------

function showSpinner( state )
{
	var spinner = searchPanel.getElementById( "spinner" );

	if( state && !spinner )
	{
		var spinner = new Image( );
		spinner.id = "spinner";
		spinner.src = "Resources/UI/Spinner.gif";
		spinner.hOffset = 196;
		spinner.vOffset = 24;
		
		searchPanel.appendChild( spinner );
	}
	else if( !state && spinner )
	{
		searchPanel.removeChild( spinner );
	}
}

// -------------------------------------------------------------------------------------------

function sizeWindow( height )
{
	// footer height: 53
	// header height: 16
	// upperContent offset: 8
	// lastUpdatedBar height: 33
	
	mainWindow.height = height;
	
	footer.vOffset = height - footer.height;
	bodyBackground.height = height - header.height - footer.height;
	
	lowerContent.vOffset = height - footer.height - lowerContent.height;

	lastUpdatedBar.vOffset = lowerContent.vOffset - lastUpdatedBar.height;
	
	upperContent.height = upperContentOrnaments.height = upperContentContainer.height = lastUpdatedBar.vOffset - 8;
	
	upperContentScrollbar.height = upperContent.height - 12;
}

// -------------------------------------------------------------------------------------------

function sqlEscape( a )
{
	if( a )
		return a.replace( /'/g, "''" );
	else
		return "";
}

// -------------------------------------------------------------------------------------------

function StockLine( )
{
	var obj = new Frame( );
	
	obj.symbol = null;
	obj.fullName = null;
	obj.change = 0;
	obj.changePercent = 0;

	obj.width = 488;
	obj.height = 28;

	obj.style.fontFamily = "Helvetica, Arial";
	obj.style.fontWeight = "bold";
	obj.style.fontSize = "12px";
	obj.style.color = "#535353";
	obj.style.background = "#FFFBF3 url( 'Resources/Window/Stock Line/Underline.png' )";
	obj.style.backgroundRepeat = "repeat-x";
	obj.style.backgroundPosition = "0px bottom";
	
	// Left side of line
	
	obj.stockSymbol = new Text( );
	obj.stockSymbol.style.fontFamily = "'Arial Black'";
	obj.stockSymbol.style.fontSize = "26px";
	obj.stockSymbol.style.color = "rgba( 135, 135, 135, 0.25 )";
	obj.stockSymbol.hOffset = 14;
	obj.stockSymbol.vOffset = 16;
	obj.appendChild( obj.stockSymbol );

	var symbolOverlay = new Image( );
	symbolOverlay.vOffset = 3;
	symbolOverlay.src = "Resources/Window/Stock Line/Symbol Text Overlay.png";
	obj.appendChild( symbolOverlay );

	obj.directionBackground = new Image( );
	obj.directionBackground.hAlign = "right";
	obj.directionBackground.hOffset = 244;
	obj.appendChild( obj.directionBackground );
	
	obj.stockName = new Text( );
	obj.stockName.style.KonTextTruncation = "end";
	obj.stockName.width = 141;
	obj.stockName.hOffset = 5;
	obj.stockName.vOffset = 23;
	obj.appendChild( obj.stockName );
	
	obj.stockValue = new Text( );
	obj.stockValue.hAlign = "right";
	obj.stockValue.hOffset = 152;
	obj.stockValue.vOffset = 23;
	obj.appendChild( obj.stockValue );

	obj.directionIndicator = new Image( );
	obj.directionIndicator.hOffset = 165;
	obj.appendChild( obj.directionIndicator );
	
	obj.stockDelta = new Text( );
	obj.stockDelta.style.fontSize = "18px";
	obj.stockDelta.hAlign = "right";
	obj.stockDelta.hOffset = 224;
	obj.stockDelta.vOffset = 20;
	obj.appendChild( obj.stockDelta );

	var edgeShadow = new Image( );
	edgeShadow.src = "Resources/Window/Stock Line/Edge Shadow.png";
	obj.appendChild( edgeShadow );

	obj.hitTarget = new Frame( );
	obj.hitTarget.width = 244;
	obj.hitTarget.height = 28;
	obj.hitTarget.onClick = stockLineSelected;
	obj.appendChild( obj.hitTarget );

	// Right side of line

	obj.stockSymbol2 = new Text( );
	obj.stockSymbol2.style.fontFamily = "'Arial Black'";
	obj.stockSymbol2.style.fontSize = "26px";
	obj.stockSymbol2.style.color = "rgba( 135, 135, 135, 0.25 )";
	obj.stockSymbol2.hOffset = 312;
	obj.stockSymbol2.vOffset = 16;
	obj.appendChild( obj.stockSymbol2 );
	obj.stockSymbol2.orderBelow( edgeShadow );

	var symbolOverlay2 = new Image( );
	symbolOverlay2.hOffset = 244;
	symbolOverlay2.vOffset = 3;
	symbolOverlay2.src = "Resources/Window/Stock Line/Symbol Text Overlay.png";
	obj.appendChild( symbolOverlay2 );
	symbolOverlay2.orderAbove( obj.stockSymbol2 );

	// Drag Button

	var dragTarget = new Image( );
	dragTarget.src = "Resources/Window/Stock Line/Square Button 0.png";
	dragTarget.hOffset = 247;
	dragTarget.vOffset = 2;
	obj.appendChild( dragTarget );
	setTooltip( dragTarget, "Drag to reorder list" );

	dragTarget.onMouseDrag = stockLineDrag;

	dragTarget.onMouseDown = function( )
	{
		this.src = this.src.replace( /0/, "1");
		this.nextSibling.colorize = "#FFFFFF";

		var stockLine = this.parentNode;
		stockLine.previousNode = stockLine.previousSibling;
		stockLine.nextNode = stockLine.nextSibling;
	
		stockLine.orderAbove( );

		this.imageOffsetY = system.event.y + this.vOffset;	
	}

	dragTarget.onMouseUp = function( )
	{
		this.src = this.src.replace( /1/, "0");
		this.nextSibling.colorize = "#C9C9C9";

		dragTimer.ticking = false;

		var stockLine = this.parentNode;
		
		if( stockLine.previousNode )
		{
			stockLine.orderAbove( stockLine.previousNode );
			stockLine.vOffset = stockLine.previousNode.vOffset + 28;
		}
		else if( stockLine.nextNode )
		{
			stockLine.orderBelow( stockLine.nextNode );
			stockLine.vOffset = stockLine.nextNode.vOffset - 28;
		}
	}

	var dragTargetIcon = new Image( );
	dragTargetIcon.src = "Resources/Window/Stock Line/Icon Drag.png";
	dragTargetIcon.hOffset = 247;
	dragTargetIcon.vOffset = 2;
	dragTargetIcon.colorize = "#C9C9C9";
	obj.appendChild( dragTargetIcon );

	// Delete/Restore Button

	var deleteButton = new Image( );
	deleteButton.src = "Resources/Window/Stock Line/Square Button 0.png";
	deleteButton.hOffset = 272;
	deleteButton.vOffset = 2;
	obj.appendChild( deleteButton );
	setTooltip( deleteButton, "Delete symbol" );

	deleteButton.onClick = stockLineDelete;

	deleteButton.mouseIsOver = false;
	deleteButton.mouseIsDown = false;
	deleteButton.functionIsDelete = true;

	deleteButton.onMouseEnter = function( )
	{
		this.mouseIsOver = true;
		
		if( this.mouseIsDown )
			if( this.functionIsDelete )
			{
				this.src = this.src.replace( /0/, 1 );
				this.nextSibling.colorize = "#FFFFFF";
			}
			else
			{
				this.src = this.src.replace( /1/, 0 );
				this.nextSibling.colorize = "#C9C9C9";
			}
	}

	deleteButton.onMouseExit = function( )
	{
		this.mouseIsOver = false;
		
		if( this.mouseIsDown )
			if( this.functionIsDelete )
			{
				this.src = this.src.replace( /1/, 0 );
				this.nextSibling.colorize = "#C9C9C9";
			}
			else
			{
				this.src = this.src.replace( /0/, 1 );
				this.nextSibling.colorize = "#FFFFFF";
			}
	}

	deleteButton.onMouseUp = function( )
	{
		this.mouseIsDown = false;
		
		if( this.mouseIsOver )
			if( this.functionIsDelete )
			{
				this.src = this.src.replace( /1/, 0 );
				this.nextSibling.colorize = "#C9C9C9";
				setTooltip( this, "Restore symbol" );
			}
			else
			{
				this.src = this.src.replace( /0/, 1 );
				this.nextSibling.colorize = "#FFFFFF";
				setTooltip( this, "Delete symbol" );
			}
	}

	deleteButton.onMouseDown = function( )
	{
		this.mouseIsDown = true;
		
		if( this.functionIsDelete )
		{
			this.src = this.src.replace( /0/, 1 );
			this.nextSibling.colorize = "#FFFFFF";
		}
		else
		{
			this.src = this.src.replace( /1/, 0 );
			this.nextSibling.colorize = "#C9C9C9";
		}
	}

	var deleteButtonIcon = new Image( );
	deleteButtonIcon.src = "Resources/Window/Stock Line/Icon Delete.png";
	deleteButtonIcon.hOffset = 272;
	deleteButtonIcon.vOffset = 2;
	deleteButtonIcon.colorize = "#C9C9C9";
	obj.appendChild( deleteButtonIcon );

	obj.stockName2 = new Text( );
	obj.stockName2.style.KonTextTruncation = "end";
	obj.stockName2.width = 166;
	obj.stockName2.hOffset = 307;
	obj.stockName2.vOffset = 23;
	obj.appendChild( obj.stockName2 );

	return obj;
}

// -------------------------------------------------------------------------------------------

function stockLineDelete( )
{
	var stockLine = this.parentNode;
	var anim = [];
	
	var duration = 250;

	var backgroundPredeleted = new Image( );
	backgroundPredeleted.src = "Resources/Window/Stock Line/Background Predeleted.png";
	backgroundPredeleted.hOffset = 244;
	backgroundPredeleted.opacity = 0;
	stockLine.appendChild( backgroundPredeleted );
	backgroundPredeleted.orderBelow( stockLine.stockName2 );

	var tmpButton = new Image( );
	tmpButton.src = "Resources/Window/Stock Line/Square Button 1.png";
	tmpButton.hOffset = 272;
	tmpButton.vOffset = 2;
	tmpButton.opacity = 0;
	stockLine.appendChild( tmpButton );
	tmpButton.orderBelow( this );

	var tmpIcon = new Image( );
	tmpIcon.src = "Resources/Window/Stock Line/Icon Restore.png";
	tmpIcon.hOffset = 272;
	tmpIcon.vOffset = 2;
	tmpIcon.opacity = 0;
	tmpIcon.colorize = "#FFFFFF";
	stockLine.appendChild( tmpIcon );
	tmpIcon.orderAbove( tmpButton );

	anim.push( new FadeAnimation( backgroundPredeleted, 255, duration, animator.kEaseOut ) );
	anim.push( new FadeAnimation( stockLine.stockName2, 100, duration, animator.kEaseOut ) );
	anim.push( new FadeAnimation( tmpButton, 255, duration, animator.kEaseOut ) );
	anim.push( new FadeAnimation( tmpIcon, 255, duration, animator.kEaseOut ) );
	anim.push( new FadeAnimation( this, 0, duration, animator.kEaseOut ) );
	anim.push( new FadeAnimation( this.nextSibling, 0, duration, animator.kEaseOut ) );

	animator.runUntilDone( anim );

	stockLine.removeChild( tmpButton );
	stockLine.removeChild( tmpIcon );

	this.src = "Resources/Window/Stock Line/Square Button 1.png";
	this.opacity = 255;

	this.nextSibling.src = "Resources/Window/Stock Line/Icon Restore.png";
	this.nextSibling.colorize = "#FFFFFF";
	this.nextSibling.opacity = 255;

	this.functionIsDelete = false;

	this.onClick = stockLineRestore;
}

// -------------------------------------------------------------------------------------------

function stockLineDrag( )
{
	var stockLine = this.parentNode;

	var duration = 100;

	var upperContentBottom = bodyBackground.vOffset + upperContent.height;

	if( system.event.vOffset > bodyBackground.vOffset && system.event.vOffset < upperContentBottom  )
	{
		dragTimer.scrollOffset = 0;
		dragTimer.ticking = false;
	}
	else
	{
		if( system.event.vOffset < bodyBackground.vOffset - 22 )
			dragTimer.scrollOffset = -12;
		else if( system.event.vOffset < bodyBackground.vOffset - 12 )
			dragTimer.scrollOffset = -3;
		else if( system.event.vOffset < bodyBackground.vOffset - 7 )
			dragTimer.scrollOffset = -1;
		else if( system.event.vOffset < bodyBackground.vOffset )
			dragTimer.scrollOffset = -0.5;

		if( system.event.vOffset > upperContentBottom + 22 )
			dragTimer.scrollOffset = 12;
		else if( system.event.vOffset > upperContentBottom + 12 )
			dragTimer.scrollOffset = 3;
		else if( system.event.vOffset > upperContentBottom + 7 )
			dragTimer.scrollOffset = 1;
		else if( system.event.vOffset > upperContentBottom )
			dragTimer.scrollOffset = 0.5;
		dragTimer.ticking = true;
	}

	var point = upperContent.convertPointFromWindow( 0, system.event.vOffset );
	
	var vOffset = point.y - this.imageOffsetY;
	
	if( vOffset < 0 )
		vOffset = 0;
	else if( vOffset > ( stockLine.parentNode.subviews.length - 1 ) * 28 )
		vOffset = ( stockLine.parentNode.subviews.length - 1 ) * 28;

	stockLine.vOffset = vOffset;
	
	if( stockLine.previousNode && stockLine.vOffset < stockLine.previousNode.vOffset + 10 )
	{
		stockLine.previousNode.vOffset += 28;

		stockLine.nextNode = stockLine.previousNode;
		stockLine.previousNode = stockLine.previousNode.previousSibling;
	}
	else if( stockLine.nextNode && stockLine.nextNode != stockLine && stockLine.vOffset > stockLine.nextNode.vOffset - 18 )
	{
		stockLine.nextNode.vOffset -= 28;

		stockLine.previousNode = stockLine.nextNode;
		stockLine.nextNode = stockLine.nextNode.nextSibling;
	}
}

// -------------------------------------------------------------------------------------------

function stockLineRestore( )
{
	var stockLine = this.parentNode;
	var anim = [];

	var duration = 250;

	var backgroundPredeleted = stockLine.stockName2.previousSibling;

	var tmpButton = new Image( );
	tmpButton.src = "Resources/Window/Stock Line/Square Button 0.png";
	tmpButton.hOffset = 272;
	tmpButton.vOffset = 2;
	tmpButton.opacity = 0;
	stockLine.appendChild( tmpButton );
	tmpButton.orderBelow( this );

	var tmpIcon = new Image( );
	tmpIcon.src = "Resources/Window/Stock Line/Icon Delete.png";
	tmpIcon.hOffset = 272;
	tmpIcon.vOffset = 2;
	tmpIcon.opacity = 0;
	tmpIcon.colorize = "#C9C9C9";
	stockLine.appendChild( tmpIcon );
	tmpIcon.orderAbove( tmpButton );

	anim.push( new FadeAnimation( backgroundPredeleted, 0, duration, animator.kEaseOut ) );
	anim.push( new FadeAnimation( stockLine.stockName2, 255, duration, animator.kEaseOut ) );
	anim.push( new FadeAnimation( tmpButton, 255, duration, animator.kEaseOut ) );
	anim.push( new FadeAnimation( tmpIcon, 255, duration, animator.kEaseOut ) );
	anim.push( new FadeAnimation( this, 0, duration, animator.kEaseOut ) );
	anim.push( new FadeAnimation( this.nextSibling, 0, duration, animator.kEaseOut ) );

	animator.runUntilDone( anim );

	stockLine.removeChild( tmpButton );
	stockLine.removeChild( tmpIcon );

	this.src = "Resources/Window/Stock Line/Square Button 0.png";
	this.opacity = 255;

	this.nextSibling.src = "Resources/Window/Stock Line/Icon Delete.png";
	this.nextSibling.colorize = "#C9C9C9";
	this.nextSibling.opacity = 255;

	this.functionIsDelete = true;

	stockLine.removeChild( backgroundPredeleted );

	this.onClick = stockLineDelete;
}

// -------------------------------------------------------------------------------------------

function stockLineSelected( )
{
	if( preferences.lastContentButtonPushed.value == "chartsButton" ) // Stock lines are only selectable when the charts panel is showing
	{
		var stockLine = this.parentNode;
		
		if( stockLine.symbol != preferences.selectedSymbol.value ) // Don't go forward if the selected symbol is already active
		{
			preferences.selectedSymbol.value = stockLine.symbol;
		
			if( preferences.lastContentButtonPushed.value == "chartsButton" ) // Render a new chart if the charts panel is showing
			{
				generateChart( preferences.lastChartRange.value )
				
				// Also reset the news, start the timers if they're not already
				newsTimer.reset( );
				newsUpdateTimer.reset( );
				newsTimer.ticking = true;
				newsUpdateTimer.ticking = true;
				getNews( );
			}
		}
	}
	else // Charts panel not showing? Send the symbol to f.y.c
	{
		openURL( "http://finance.yahoo.com/q?s=" + escape( this.parentNode.symbol ) );
	}
}

// -------------------------------------------------------------------------------------------

function StyledText( textType )
{
	var obj = new Text( );

	obj.style.fontFamily = "Helvetica, Arial";
	obj.style.fontWeight = "bold";
	obj.style.fontSize = "10px";

	switch( textType )
	{
		case "chart":
		obj.style.color = "#535353";
		break;

		case "form":
		obj.style.color = "#4D4D4D";
		break;
	}

	return obj;
}

// -------------------------------------------------------------------------------------------

function symbolSort( a, b )
{
	if( a._exchange == b._exchange )
	{
		if( a._symbol < b._symbol )
			return -1;
		else if( a._symbol > b._symbol )
			return 1;
		else
			return 0;
	}
	else
	{
		if( a._exchange < b._exchange )
			return -1;
		else // must be greater
			return 1;
	}
}

// -------------------------------------------------------------------------------------------

function toggle( value )
{
	return Number( !Number( value ) );
}

// -------------------------------------------------------------------------------------------

function toggleLowerContentDisplay( )
{
	var finalState, finalImage;
	var sizer = new CustomAnimation( 1, animateLowerContent );

	var chartsButton = footer.getElementById( "chartsButton" );
	var searchButton = footer.getElementById( "searchButton" );

	sizer.duration = 250;
	sizer.startHeight = mainWindow.height;

	chartsPanel.visible = true;
	searchPanel.visible = true;

	var bestDisplay = mainWindow.getBestDisplay( ); // Thanks, Ed for the Display object; favored entrant for Best New Object of 2007

	sizer.screenHeight = bestDisplay.workRect.height + bestDisplay.workRect.y;

	if( mainWindow.vOffset > gLastPosition + 5 || mainWindow.vOffset < gLastPosition - 5 )
		gLastPosition = gCollapsedPosition = gBumpStamp = null;

	newsTimer.ticking = false;
	newsUpdateTimer.ticking = false;

	if( preferences.expandedView.value == 0 ) // open it
	{
		clearSearchField( );

		chartsPanel.opacity = searchPanel.opacity = 0;
		
		lowerContent.getElementById( this.id.substr( 0, 6 ) + "Panel" ).opacity = 255;
	
		sizer.endHeight = mainWindow.height + gExpandedViewHeight;
		sizer.finalState = "open";

		if( this.id == "searchButton" )
		{
			var anim = animateStockLines( "left" );
			setTooltip( searchButton, "Save changes to symbols" );
			setTooltip( chartsButton, "Save changes to symbols and show chart" );
		}
		else
		{
			var anim = [];
			preferences.chartsPanelDisplayed.value = 1;
			setTooltip( searchButton, "Add/edit symbols" );
			setTooltip( chartsButton, "Hide chart" );
		}

		var stockLine = upperContent.firstChild;

		while( stockLine )
		{
			setTooltip( stockLine.hitTarget, "Show chart for " + stockLine.symbol );
	
			stockLine = stockLine.nextSibling;
		}

		anim.push( sizer );

		animator.runUntilDone( anim );

 		if( this.id == "chartsButton" && upperContent.firstChild )
 		{
 			if( preferences.selectedSymbol.value == "" )
 				preferences.selectedSymbol.value = upperContent.firstChild.symbol;
 			
 			// Some of stockLineSelected( ) replicated here
 			
			generateChart( preferences.lastChartRange.value )
			
			// Also reset the news, start the timers if they're not already
			newsTimer.reset( );
			newsUpdateTimer.reset( );
			newsTimer.ticking = true;
			newsUpdateTimer.ticking = true;
			getNews( );
 		}

		preferences.expandedView.value = toggle( preferences.expandedView.value );

		preferences.lastContentButtonPushed.value = this.id;
	}
	else if( this.id == preferences.lastContentButtonPushed.value && !( preferences.chartsPanelDisplayed.value == 1 && this.id == "searchButton" ) ) // close it, unless the chart panel had been open before opening the search panel
	{
		// reset button state

		this.firstChild.src = this.firstChild.src.replace( /1/, "0");
		this.lastChild.colorize = gBtnIconColor;

		sizer.endHeight = mainWindow.height - gExpandedViewHeight;
		sizer.finalState = "closed";

		if( this.id == "searchButton" )
			var anim = animateStockLines( "right" );
		else
			var anim = [];

		setTooltip( searchButton, "Add/edit symbols" );
		setTooltip( chartsButton, "Show chart" );

		anim.push( sizer );

		animator.runUntilDone( anim );

		var stockLine = upperContent.firstChild;

		while( stockLine )
		{
			setTooltip( stockLine.hitTarget, "Open web page for " + stockLine.symbol );
	
			stockLine = stockLine.nextSibling;
		}

		clearChartsPanel( );

		preferences.expandedView.value = toggle( preferences.expandedView.value );
		
		checkForModifiedStockLines( );
		
		preferences.lastContentButtonPushed.value = "";
		preferences.chartsPanelDisplayed.value = 0;

		clearSearchField( );
	}
	else // toggle between open states
	{
		if( preferences.chartsPanelDisplayed.value == 0 )
		{
			preferences.chartsPanelDisplayed.value = 1;
			
			if( this.id == "searchButton" )
			{
				var anim = animateStockLines( "left" );
				setTooltip( searchButton, "Save changes to symbols" );
				setTooltip( chartsButton, "Save changes to symbols and show chart" );
			}
			else
			{
				var anim = animateStockLines( "right" );
				setTooltip( searchButton, "Add/edit symbols" );
				setTooltip( chartsButton, "Hide chart" );
			}
		}
		else
		{
			if( this.id == "searchButton" && preferences.lastContentButtonPushed.value != "chartsButton" )
			{
				chartsButton.onClick( );
				return;
			}
			else if( this.id == "searchButton" )
			{
				var anim = animateStockLines( "left" );
				setTooltip( searchButton, "Save changes to symbols" );
				setTooltip( chartsButton, "Save changes to symbols and show chart" );
			}
			else
			{
				var anim = animateStockLines( "right" );
				
				searchButton.selected = false;
				searchButton.firstChild.src = searchButton.firstChild.src.replace( /1/, "0");
				searchButton.lastChild.colorize = gBtnIconColor;
				
				chartsButton.selected = true;
				chartsButton.firstChild.src = chartsButton.firstChild.src.replace( /0/, "1");
				chartsButton.lastChild.colorize = gBtnIconSelectedColor;

				setTooltip( searchButton, "Add/edit symbols" );
				setTooltip( chartsButton, "Hide chart" );
			}
		}

		anim.push( new FadeAnimation( lowerContent.getElementById( preferences.lastContentButtonPushed.value.substr( 0, 6 ) + "Panel" ), 0, 250, animator.kEaseNone ) );
		anim.push( new FadeAnimation( lowerContent.getElementById( this.id.substr( 0, 6 ) + "Panel" ), 255, 250, animator.kEaseNone ) );

		animator.runUntilDone( anim );

		checkForModifiedStockLines( );

 		if( this.id == "chartsButton" && upperContent.firstChild )
 		{
 			if( preferences.selectedSymbol.value == "" )
 				preferences.selectedSymbol.value = upperContent.firstChild.symbol;
 			
 			// Some of stockLineSelected( ) replicated here
 			
			generateChart( preferences.lastChartRange.value )
			
			// Also reset the news, start the timers if they're not already
			newsTimer.reset( );
			newsUpdateTimer.reset( );
			newsTimer.ticking = true;
			newsUpdateTimer.ticking = true;
			getNews( );
 		}
		else
		{
			clearChartsPanel( );
		}

		preferences.lastContentButtonPushed.value = this.id;
	}

	// Turn off the visibility of the rear panel to prevent its tooltips from popping up

	if( chartsPanel.opacity == 0 )
		chartsPanel.visible = false;
	else if( searchPanel.opacity == 0 )
		searchPanel.visible = false;

	preferences.windowHeight.value = mainWindow.height;
}

// -------------------------------------------------------------------------------------------

function toggleNumberDisplay( )
{
	preferences.displayPercentageValues.value = toggle( preferences.displayPercentageValues.value );

	if( preferences.displayPercentageValues.value == 1 )
	{
		this.lastChild.src = "Resources/UI/Button Icons/Number.png";
		setTooltip( this, "Show monetary change" );
	}
	else
	{
		this.lastChild.src = "Resources/UI/Button Icons/Percent.png";
		setTooltip( this, "Show percentage change" );
	}

	var stockLine = upperContent.firstChild;

	var widestTextWidth = 0;

	while( stockLine )
	{
		if( preferences.displayPercentageValues.value == 1 )
			stockLine.stockDelta.data = Math.abs( stockLine.changePercent ).toFixed( preferences.precision.value ) + "%";
		else
			stockLine.stockDelta.data = Math.abs( stockLine.change ).toFixed( preferences.precision.value );

		if( stockLine.stockDelta.width > widestTextWidth )
			widestTextWidth = stockLine.stockDelta.width;

		stockLine = stockLine.nextSibling;
	}

	updateStockTextPosition( widestTextWidth );
}

// -------------------------------------------------------------------------------------------

function UIbasicButton( )
{
	var obj = new Frame( );
	obj.toggle = false;
	obj.mouseIsOver = false;
	obj.mouseIsDown = false;
	obj.selected = false;
	
	var img = new Image( );
	img.src = "Resources/UI/Static Button/Round Button 0.png";
	obj.appendChild( img );
		
	obj.width = img.width;
	obj.height = img.height;
	
	obj.text = new Text( );
	obj.text.hAlign = "center";
	obj.text.hOffset = obj.width / 2;
	obj.text.vOffset = 14;
	obj.text.style.fontFamily = "helvetica, arial";
	obj.text.style.fontWeight = "bold";
	obj.text.style.fontSize = "10px";
	obj.text.style.color = gBtnIconColor;
	obj.appendChild( obj.text );

	obj.onMouseEnter = function( )
	{
		this.mouseIsOver = true;
		
		if( this.mouseIsDown )
		{
			this.firstChild.src = this.firstChild.src.replace( /0/, "1");
		
			if( this.lastChild instanceof Image )
				this.lastChild.colorize = gBtnIconSelectedColor;
			else
				this.text.style.color = gBtnIconSelectedColor;
		}
	}

	obj.onMouseExit = function( )
	{
		this.mouseIsOver = false;
		
		if( this.mouseIsDown && !this.selected )
		{
			this.firstChild.src = this.firstChild.src.replace( /1/, "0");

			if( this.lastChild instanceof Image )
				this.lastChild.colorize = gBtnIconColor;
			else
				this.text.style.color = gBtnIconColor;
		}
	}

	obj.onMouseUp = function( )
	{
		this.mouseIsDown = false;
		
		if( this.mouseIsOver )
		{
			if( this.toggle && !this.selected )
			{
				var button = this.parentNode.firstChild;
				
				while( button )
				{
					if( button.selected )
					{
						button.selected = false;
						button.firstChild.src = button.firstChild.src.replace( /1/, "0");

						if( button.lastChild instanceof Image )
							button.lastChild.colorize = gBtnIconColor;
						else
							button.text.style.color = gBtnIconColor;
					}
					button = button.nextSibling;
				}
				this.selected = true;			
			}
			else if( !this.selected )
			{
				this.firstChild.src = this.firstChild.src.replace( /1/, "0");

				if( this.lastChild instanceof Image )
					this.lastChild.colorize = gBtnIconColor;
				else
					this.text.style.color = gBtnIconColor;
			}
		}
	}

	obj.onMouseDown = function( )
	{
		this.mouseIsDown = true;
		
		this.firstChild.src = this.firstChild.src.replace( /0/, "1");

		if( this.lastChild instanceof Image )
			this.lastChild.colorize = gBtnIconSelectedColor;
		else
			this.text.style.color = gBtnIconSelectedColor;
	}

	return obj;
}

// -------------------------------------------------------------------------------------------

function UIbutton( )
{
	var obj = new Frame( );
	obj.mouseIsOver = false;
	obj.mouseIsDown = false;
	obj.active = true;

	obj.height = 20;

	var img = new Image( );
	img.src = "Resources/UI/Button/Fill 0.png";
	img.hOffset = 7;
	obj.appendChild( img );

	var img = new Image( );
	img.src = "Resources/UI/Button/Right Cap 0.png";
	img.hAlign = "right";
	obj.appendChild( img );

	var img = new Image( );
	img.src = "Resources/UI/Button/Left Cap 0.png";
	obj.appendChild( img );

	obj.text = new Text( );
	obj.text.hAlign = "center";
	obj.text.vOffset = 13;
	obj.text.style.fontFamily = "helvetica, arial";
	obj.text.style.fontWeight = "bold";
	obj.text.style.fontSize = "12px";
	obj.text.style.color = "#6C6C6C";
	obj.appendChild( obj.text );

	obj.onMouseEnter = function( )
	{
		this.mouseIsOver = true;
		
		if( this.mouseIsDown )
			this.setHighlight( true );
	}

	obj.onMouseExit = function( )
	{
		this.mouseIsOver = false;
		
		if( this.mouseIsDown )
			this.setHighlight( false );
	}

	obj.onMouseUp = function( )
	{
		this.mouseIsDown = false;
		
		if( this.mouseIsOver )
			this.setHighlight( false );
	}

	obj.onMouseDown = function( )
	{
		if( this.active )
		{
			this.mouseIsDown = true;
			
			this.setHighlight( true );
		}
	}

	obj.setActive = function( active )
	{
		this.active = active;
		
		var opacity = active ? 1 : gInactiveControlOpacity;
		
		this.opacity = 255 * opacity;
	}

	obj.setHighlight = function( highlight )
	{
		var currentState = !highlight ? 1 : 0;
		var newState = highlight ? 1 : 0;
		
		var re = new RegExp( currentState, "g" )
		
		var img = this.firstChild;
		
		while( img != "[object Text]" )
		{
			img.src = img.src.replace( re, newState );
			img = img.nextSibling;
		}
		
		if( highlight )
		{
			this.lastChild.style.color = "#FFFFFF";
		}
		else
		{
			this.lastChild.style.color = "#6C6C6C";
		}
	}
	
	obj.setLabel = function( text )
	{
		this.lastChild.data = text;
	}
	
	obj.setWidth = function( width )
	{
		this.width = width;
		var cap = this.firstChild.nextSibling;
		this.firstChild.width = width - cap.width - 7;
		cap.hOffset = width;
		
		if( this.firstChild.width < this.lastChild.width )
			this.lastChild.width = this.firstChild.width;
		else
			this.lastChild.width = null;
	}

	return obj;
}

// -------------------------------------------------------------------------------------------

function UIpopup( )
{
	var obj = new Frame( );
	
	obj.height = 20;
	obj.active = true;
	obj.menuArray = [];
	
	var img = new Image( );
	img.src = "Resources/UI/Popup/Fill.png";
	img.hOffset = 7;
	obj.appendChild( img );

	var img = new Image( );
	img.src = "Resources/UI/Popup/Right Cap 0.png";
	img.hAlign = "right";
	obj.appendChild( img );

	var img = new Image( );
	img.src = "Resources/UI/Popup/Left Cap.png";
	obj.appendChild( img );

	var label = new Text( );
	label.hOffset = 7;
	label.vOffset = 13;
	label.style.fontFamily = "Helvetica, Arial";
	label.style.fontWeight = "bold";
	label.style.fontSize = "12px";
	label.style.color = "#6C6C6C";
	label.style.KonTextTruncation = "end";
	obj.appendChild( label );
	
	obj.setWidth = function( width )
	{
		this.width = width;
		var cap = this.firstChild.nextSibling;
		this.firstChild.width = this.lastChild.width = width - cap.width - 7;
		cap.hOffset = width;
	}

	obj.setLabel = function( text )
	{
		this.lastChild.data = text;
	}

	obj.setActive = function( active )
	{
		this.active = active;
		
		var opacity = active ? 1 : gInactiveControlOpacity;
		
		this.opacity = 255 * opacity;
	}

	obj.onMouseDown = function( )
	{
		if( this.active )
		{
			var cap = this.firstChild.nextSibling;
			cap.src = cap.src.replace( /0/g, "1" );
	
			for( var i = 0; i < this.menuArray.length; i++ )
			{
				if( this.lastChild.data == this.menuArray[i].title )
					this.menuArray[i].checked = true;
				else
					this.menuArray[i].checked = false;
			}
	
			var point = this.convertPointToWindow( 0, 0 );
			popupMenu( this.menuArray, point.x + 1, point.y + this.height - 1 );
			
			cap.src = cap.src.replace( /1/g, "0" );
		}
	}

	return obj;
}

// -------------------------------------------------------------------------------------------

function updateStockDisplay( )
{
	var result = financeDB.query( "SELECT * FROM quotes ORDER BY sortkey" );
	var quotes = result.getAll( );
	result.dispose( );

	for( var i = 0; i < quotes.length; i++ )
	{
		var stockLine = upperContent.getElementById( "id_" + quotes[i]["sortkey"] );
		
		if( !stockLine )
		{
			stockLine = new StockLine( );
			stockLine.id = "id_" + quotes[i]["sortkey"];
			stockLine.vOffset = upperContent.lastChild ? upperContent.lastChild.vOffset + upperContent.lastChild.height : 0;
			upperContent.appendChild( stockLine );
		}

		// quotes ( symbol TEXT, fullName TEXT, timestamp TEXT, lasttrade REAL, change REAL, changePercent REAL, link TEXT, sortkey INTEGER )
	
		stockLine.symbol 		= quotes[i]["symbol"];
		stockLine.fullName 		= quotes[i]["fullName"];
		stockLine.change 		= Number( quotes[i]["change"] );
		stockLine.changePercent = Number( quotes[i]["changePercent"] );

		stockLine.stockName.data = stockLine.stockName2.data = stockLine.fullName;
		stockLine.stockSymbol.data = stockLine.stockSymbol2.data = stockLine.symbol;

		stockLine.stockValue.data = quotes[i]["lasttrade"].toFixed( preferences.precision.value );

		stockLine.stockName.width = stockLine.stockValue.hOffset - stockLine.stockName.hOffset - stockLine.stockValue.width - 10;

		if( preferences.chartsPanelDisplayed.value == 1 )
			setTooltip( stockLine.hitTarget, "Show chart for " + stockLine.symbol );
		else
			setTooltip( stockLine.hitTarget, "Open web page for " + stockLine.symbol );

		if( preferences.displayPercentageValues.value == 1 )
		{
			var stockDelta = stockLine.changePercent;
			stockLine.stockDelta.data = Math.abs( stockLine.changePercent ).toFixed( preferences.precision.value ) + "%";
		}
		else
		{
			var stockDelta = stockLine.change;
			stockLine.stockDelta.data = Math.abs( stockLine.change ).toFixed( preferences.precision.value );
		}

		if( stockDelta < 0 )
		{
			stockLine.directionBackground.src	= "Resources/Window/Stock Line/Down.png";
			stockLine.directionIndicator.src	= "Resources/Window/Stock Line/Down Arrow.png";
			stockLine.stockDelta.style.color	= "#770e09";
		}
		else if( stockDelta > 0 )
		{
			stockLine.directionBackground.src	= "Resources/Window/Stock Line/Up.png";
			stockLine.directionIndicator.src	= "Resources/Window/Stock Line/Up Arrow.png";
			stockLine.stockDelta.style.color	= "#2f7800";
		}
		else
		{
			stockLine.directionBackground.src	= null;
			stockLine.directionIndicator.src	= null;
			stockLine.stockDelta.style.color	= "#535353";
		}
	}

	upperContent.updateScrollBars( );

	updateStockTextPosition( );
}

// -------------------------------------------------------------------------------------------

function updateStockTextPosition( widestTextWidth )
{
	var scrollOffset = upperContentScrollbar.visible ? 224 : 238; // 14

	if( !widestTextWidth )
	{
		var stockLine = upperContent.firstChild;
	
		widestTextWidth = 0;
	
		while( stockLine )
		{
			if( stockLine.stockDelta.width > widestTextWidth )
				widestTextWidth = stockLine.stockDelta.width;
		
			stockLine = stockLine.nextSibling;
		}
	}

	var stockLine = upperContent.firstChild;

	while( stockLine )
	{
		stockLine.stockDelta.hOffset = scrollOffset;
	
		stockLine.directionIndicator.hOffset = stockLine.stockDelta.hOffset - widestTextWidth - 19;
		
		stockLine.stockValue.hOffset = stockLine.directionIndicator.hOffset - 14;

		stockLine.stockName.width = stockLine.stockValue.hOffset - stockLine.stockName.hOffset - stockLine.stockValue.width - 10;

		stockLine = stockLine.nextSibling;
	}
}

// -------------------------------------------------------------------------------------------

function dumpDB( )
{
	var result = financeDB.query( "SELECT * FROM chart" );
	var results = result.getAll( );

	print( ">>> chart" );
	for( var i = 0; i < results.length; i++ )
	{
		print( i, results[i]["symbol"], results[i]["range"], results[i]["timestamp"], results[i]["storedXML"].replace(/\r|\n|\t|  +/g, "") );
	}
	print( "<<< chart" );

	result.dispose( );

	var result = financeDB.query( "SELECT * FROM quotes" );
	var results = result.getAll( );

	print( "***>>> quotes" );
	for( var i = 0; i < results.length; i++ )
	{
		print( i, results[i]["symbol"], results[i]["name"], results[i]["timestamp"], results[i]["lasttrade"], results[i]["change"], results[i]["changePercent"], results[i]["sortkey"] );
	}
	print( "***<<< quotes" );

	result.dispose( );

	var result = financeDB.query( "SELECT * FROM news" );
	var results = result.getAll( );

	print( "***>>> news" );
	for( var i = 0; i < results.length; i++ )
	{
		print( i, results[i]["symbol"], results[i]["timestamp"], results[i]["lastBuildDate"], results[i]["storedXML"].replace(/\r|\n|\t|  +/g, "") );
	}
	print( "***<<< news" );

	result.dispose( );
}
