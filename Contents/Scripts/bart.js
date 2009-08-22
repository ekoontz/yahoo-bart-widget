log("reading 'bart_eta.xml'");
var bartEtaDoc = XMLDOM.parse( filesystem.readFile( "bart_eta.xml" ) );

stations = bartEtaDoc.evaluate( "root/station/name" );

log("finished reading 'bart_eta.xml'");

log("opening bart database from file: " + system.widgetDataFolder + "/bart.db");
bartDB = new SQLite( );
bartDB.open( system.widgetDataFolder + "/bart.db" );
initDB(bartDB);
log("finished reading bart database.");

table_data_frame = bartWindow.getElementById("barttable");

var vOffset = 0;
var station = "Powell St.";

function initDB(db) {
    try
    {
	/* Definitions: 
           1. Connection(A,B,D)
           station A is connected to station B 
           by a D-bound train (Connection(A,B,D)
           i.e. "you can get from A to B via the D-bound train"
            if: 
             A has a <eta/Destination = D> 
            and
             B is D-before or equal to Destination.

            For example, Connection(Glen Park,South Hayward,Fremont) is
              true because for Glen Park, 
               there is a <eta[destination='Fremont']>
               and
               South Hayward is D-before Fremont. 

          2. D-before(A,D)
           station A is D-before D if 
           there exists a D-bound train from A.
            AND 
            ( A is adjacent to D (base case)
           OR
           there exists another station B such that
             D-before(B,D)
            AND A is adjacent to B. (recursive case))

          Example 1: Union City is D-before Fremont because:
              1. there is a Fremont-bound train from South Hayward
             AND
              2. Union City is adjacent to Fremont.

          Example 2: South Hayward is D-before Fremont because:
              1. there is a Fremont-bound train from South Hayward
             AND
              2. Union City is D-before Fremont (by Example 1).
             AND
              3. South Hayward is adjacent to Union City.

          Example 3:  Hayward is D-before Fremont because:
              1. there is a Fremont-bound train from Hayward
             AND
              2. South Hayward is D-before Fremont (by Example 2).
             AND
              3. Hayward is adjacent to South Hayward.

          Example 4. Bay Fair is D-before Fremont because
              1. there is a Fremont-bound train from Bay Fair
             AND
              2. Hayward is D-before Fremont (by Example 3).
             AND
              3. Bay Fair is adjacent to Hayward.

          ...and so on for all stations that are D-before Fremont.

          Notes:
           Note 1: adjacency is reflexive: adjacent(A,B) <=> adjacent(B,A)
           Note 2:  that D-before is only significant if station D 
           is a final destination
           of some train. We don't care about D-before for stations that
           are not in this subset.
           
           The D-before transitive closure must be re-computed every time
            the BART data feed is refreshed.

	( See : 
	    http://www.bart.gov/images/global/system-map23.gif
           for Graphical representation of the graph.

            http://www.bart.gov/dev/eta/bart_eta.xml

           for XML representation of the graph (although adjacency information
            is not stated or inferrable.)

         */
	db.exec("CREATE TABLE IF NOT EXISTS station (name TEXT,abbr TEXT PRIMARY KEY)");
	db.exec("CREATE TABLE IF NOT EXISTS adjacent (station_a TEXT, station_b TEXT)");
	db.exec("DELETE FROM adjacent");
	db.exec("INSERT INTO adjacent (station_a,station_b) VALUES ('EMBR','WOAK')");
	db.exec("INSERT INTO adjacent (station_a,station_b) VALUES ('MONT','EMBR')");
	db.exec("CREATE TABLE IF NOT EXISTS d_before (from_station TEXT,final_destination TEXT)");
    }
    catch (e) {
	log("could not create tables in bart database.");
	log(e);
    }
}


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

