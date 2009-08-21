log("reading 'bart_eta.xml'");
var bartEtaDoc = XMLDOM.parse( filesystem.readFile( "bart_eta.xml" ) );

stations = bartEtaDoc.evaluate( "root/station/name" );

log("finished reading 'bart_eta.xml'");

log("opening bart database.");
bartDB = new SQLite( );
bartDB.open( system.widgetDataFolder + "/bart.db" );
log("finished reading bart database.");

table_data_frame = bartWindow.getElementById("barttable");

var vOffset = 0;
var station = "Powell St.";

function myStatusProc() {
    log("got here..(myStatusProc()");
}

    var request = new XMLHttpRequest();
    request.onreadystateexchange = myStatusProc;
    request.open("GET","http://www.bart.gov/dev/eta/bart_eta.xml",false);
    request.send();
    if (request.status == 200) {
	arrival_times = XMLDOM.parse(request.responseXML.toXML());
    }
    else {
	log("could not retrieve response from http://www.bart.gov.");
    }

    // 1st leg of journey
    bart_row = new bartStation("Powell to Dublin/Pleasanton");
    table_data_frame.appendChild(bart_row);
    estimate = arrival_times.evaluate("string(/root/station[name='Powell St.']/eta[destination='Dublin/Pleasanton']/estimate)");
    bart_row = new bartStation(estimate);
    table_data_frame.appendChild(bart_row);

    // 2nd leg of journey
    bart_row = new bartStation("MacArthur to Richmond");
    table_data_frame.appendChild(bart_row);

    estimate = arrival_times.evaluate("string(/root/station[name='MacArthur']/eta[destination='Richmond']/estimate)");
    bart_row = new bartStation(estimate);
    table_data_frame.appendChild(bart_row);

//refreshPrefs.onTimerFired = loadStations();

function loadStations() {
/*    station_dropdown = preferences.leaving_from;
    log("loadStations()" + station_dropdown);
    foo = XMLDOM.parse( filesystem.readFile( "bart_eta.xml" ) );
    bar = foo.getElementById("foo");
    baz = foo.createElement("option");
    log(baz);
    log(preferences.leaving_from);
    test = widget.importNode(baz);
//    preferences.leaving_from.importNode(baz);
    refreshPrefs.interval = 10;
*/
}

function initialize() {
}

function about() {
    loadStations();
    alert("By Eugene Koontz (ekoontz@hiro-tan.org)");

}

function bartStation( text ) {
    var obj = new Frame( );
    
    obj.symbol = null;
    obj.fullName = null;
    obj.change = 0;
    obj.changePercent = 0;

    obj.width = 200;
    obj.height = 28;
    obj.hOffset = 30;
    obj.vOffset = vOffset;
    vOffset += 15; // increment global
    obj.text = new Text( );
    obj.text.style.fontFamily = "'Arial Black'";
    obj.text.style.fontSize = "14px";
    obj.text.style.color = "#00ff00";
    obj.text.hOffset = 14;
    obj.text.vOffset = 16;
    obj.text.data = text;
    obj.appendChild( obj.text );

    return obj;
}

