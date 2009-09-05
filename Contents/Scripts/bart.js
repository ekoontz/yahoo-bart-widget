
table_data_frame = bartWindow.getElementById("barttable");

var vOffset = 0;
var station = "Powell St.";

//var online = true;
var online = false;
var bartEtaDoc;
initDB();

function initDB() {

    try {
	if (online == true) {
	    log("loading remote 'bart_eta.xml'");
	    var request = new XMLHttpRequest();
	    request.onreadystateexchange = myStatusProc;
	    request.open("GET","http://www.bart.gov/dev/eta/bart_eta.xml",false);
	    request.send();
	    if (request.status == 200) {
		bartEtaDoc = XMLDOM.parse(request.responseXML.toXML());
	    }
	    else {
		log("could not retrieve response from http://www.bart.gov.");
	    }

	}
	else {
	    log("reading local 'bart_eta.xml'");
	    bartEtaDoc = XMLDOM.parse( filesystem.readFile( "bart_eta.xml" ) );
	}
	log("..ok.");
    }
    catch(e) {
	log("exception reading bart_eta.xml: " + e);
	return;
    }

    try {
	log("opening bart database from file: " + system.widgetDataFolder + "/bart.db");
	db = new SQLite( );
	db.open( system.widgetDataFolder + "/bart.db" );
	log("..ok.");
    }
    catch (e) {
	log("exception opening database");
	return;
    }

    try {
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
              1. there is a Fremont-bound train from Union City
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
            is not stated or inferrable from this XML.)

         */
	db.exec("CREATE TABLE IF NOT EXISTS station (name TEXT,abbr CHAR(4) PRIMARY KEY)");
	db.exec("DELETE FROM station");

	db.exec("CREATE TABLE IF NOT EXISTS d_before (from_station TEXT,final_destination TEXT)");
	db.exec("DELETE FROM d_before");

	db.exec("CREATE TABLE IF NOT EXISTS destination (station TEXT,destination TEXT, eta TEXT)");
	db.exec("DELETE FROM destination");

	/* populate stations from server XML response. */
	stations = bartEtaDoc.evaluate( "/root/station" );
	for (var i = 0; i < stations.length; i++) {
	    station = stations.item(i);
	    station_name = station.evaluate("name[1]/text()").item(0).nodeValue;

	    if (station_name == "San Francisco Int'l Airport") {
		station_name = "SF Airport";
	    }

	    station_abbr = station.evaluate("abbr[1]/text()").item(0).nodeValue;
	    station_name = station_name.replace(/\'/g,'\'\'');

	    db.exec("INSERT INTO station (name,abbr) VALUES ('"+station_name+"','"+station_abbr+"')");
	}

	/* populate d-before relation (base case) */
	destinations = bartEtaDoc.evaluate( "/root/station/eta/destination/text()" );
	for (var i = 0; i < destinations.length; i++) {
	    destination = destinations.item(i);
	    station_name = destination.evaluate("ancestor::station/name/text()").item(0).nodeValue.replace(/\'/g,'\'\'');
	    eta = destination.evaluate("ancestor::eta/estimate/text()").item(0).nodeValue;
	    destination_name = destination.nodeValue.replace(/\'/g,'\'\'');

	    log("station: " + station_name + "; destination: " + destination_name);

	    if (false) {
		log("INSERT INTO destination(station,destination,eta)" +
                    "VALUES ('" + station_name + "' , '" + destination_name + "' , '" + eta + "')");
	    }
	    db.exec("INSERT INTO destination(station,destination,eta)" +
                "VALUES ('" + station_name + "' , '" + destination_name + "' , '" + eta + "')");

            /* exactly one of the following INSERT statements will actually do an insert, but 
               we don't know which for any particular pair, so we have to try both. */
	    var insert_sql;
	    
	    insert_sql = "INSERT INTO d_before(from_station,final_destination) " +
                    "     SELECT station_a.abbr, station_b.abbr           " +
                    "       FROM adjacent                                 " +
                    " INNER JOIN station station_a                        " +
                    "         ON station_a.abbr = station_a               " +
                    " INNER JOIN station station_b                        " +
                    "         ON station_b.abbr = station_b               " +
                    "        AND (station_a.name = '"+ station_name + "') " +
                    "        AND (station_b.name = '"+ "Richmond"   + "') " +
                    "        AND (station_b.name = '"+ destination_name + "')";

//	    log(insert_sql);
            db.exec(insert_sql);

	    insert_sql = "INSERT INTO d_before(final_destination,from_station) " +
                    "     SELECT station_a.abbr, station_b.abbr           " +
                    "       FROM adjacent                                 " +
                    " INNER JOIN station station_a                        " +
                    "         ON station_a.abbr = station_a               " +
                    " INNER JOIN station station_b                        " +
                    "         ON station_b.abbr = station_b               " +
                    "        AND (station_b.name = '"+ station_name + "') " +
                    "        AND (station_a.name = '"+ "Richmond"   + "') " +
                    "        AND (station_a.name = '"+ destination_name + "')";

//	    log(insert_sql);
            db.exec(insert_sql);	    

	    
	}

	/* populate d-before relation (recursive definition) */
	/* ('recursive' in the sense of the definition of d-before, not the implementation). */
	/* currently needs (at most) 16 iterations to do the transitive closure. */
	for(j = 0; j < 10; j++) {
	    
	    if ((j % 5) == 0) {
		log("d_before inference iteration # " + j);
	    }
	    
	    var query = "" +
"INSERT INTO d_before (from_station,final_destination) \n"+
"     SELECT adjacent.station_b,adj.final_destination \n"+
"       FROM adjacent  \n"+
" INNER JOIN d_before adj \n"+
"         ON (station_a = adj.from_station)\n"+
" INNER JOIN station new  \n"+
"         ON new.abbr = station_b  \n"+
" INNER JOIN station dest  \n"+
"         ON dest.abbr = adj.final_destination \n"+
" INNER JOIN destination  \n"+
"         ON dest.name = destination.destination \n"+
"        AND destination.station = new.name \n"+
"  LEFT JOIN d_before existing \n"+
"         ON existing.from_station = adjacent.station_b \n"+
"        AND existing.final_destination = adj.final_destination \n"+
"      WHERE existing.from_station IS NULL  \n"+
"        AND existing.final_destination IS NULL; \n"+
"";
	log(query);
	db.exec(query);

	    query = ""+
"INSERT INTO d_before (from_station,final_destination)  \n"+
"     SELECT adjacent.station_a,adj.final_destination \n"+
"       FROM adjacent  \n"+
" INNER JOIN d_before adj \n"+
"         ON (station_b = adj.from_station) \n"+
" INNER JOIN station new  \n"+
"         ON new.abbr = station_a  \n"+
" INNER JOIN station dest  \n"+
"         ON dest.abbr = adj.final_destination \n"+
" INNER JOIN destination  \n"+
"         ON dest.name = destination.destination \n"+
"        AND destination.station = new.name \n"+
"  LEFT JOIN d_before existing \n"+
"         ON existing.from_station = adjacent.station_a \n"+
"        AND existing.final_destination = adj.final_destination \n"+
"      WHERE existing.from_station IS NULL  \n"+
		"        AND existing.final_destination IS NULL; \n"+
		"";
	log(query);
	db.exec(query);

	}
    }
    catch (e) {
	log("could not create tables in bart database.");
	log(e);
    }
}

    // 1st leg of journey
    bart_row = new bartStation("Powell to Dublin/Pleasanton");
    table_data_frame.appendChild(bart_row);
    estimate = bartEtaDoc.evaluate("string(/root/station[name='Powell St.']/eta[destination='Dublin/Pleasanton']/estimate)");
    bart_row = new bartStation(estimate);
    table_data_frame.appendChild(bart_row);

    // 2nd leg of journey
    bart_row = new bartStation("MacArthur to Richmond");
    table_data_frame.appendChild(bart_row);

    estimate = bartEtaDoc.evaluate("string(/root/station[name='MacArthur']/eta[destination='Richmond']/estimate)");
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

