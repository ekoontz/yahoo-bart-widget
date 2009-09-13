
table_data_frame = bartWindow.getElementById("barttable");

var vOffset = 0;

var online = true;
//var online = false;
var bartEtaDoc;

function initDB() {

    try {
	if (online == true) {
	    log("loading remote 'bart_eta.xml'");
	    var request = new XMLHttpRequest();
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

    try {
	db.exec("CREATE TABLE IF NOT EXISTS station (name TEXT,abbr CHAR(4) PRIMARY KEY)");
	db.exec("DELETE FROM station");
	
	db.exec("CREATE TABLE IF NOT EXISTS d_before (from_station TEXT,final_destination TEXT, distance INTEGER)");
	db.exec("DELETE FROM d_before");

	db.exec("CREATE TABLE IF NOT EXISTS destination (station TEXT,destination TEXT, eta TEXT)");
	db.exec("DELETE FROM destination");

    }
    catch (e) {
	log("could not create tables in bart database.");
	log(e);
    }

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
	
	try {
	    db.exec("INSERT INTO station (name,abbr) VALUES ('"+station_name+"','"+station_abbr+"')");
	}
	catch(e) {
	    log("error: could not insert station:" + e);
	}
    }

    log("doing initial case d_before()");

    /* populate d-before relation (base case) */
    destinations = bartEtaDoc.evaluate( "/root/station/eta/destination/text()" );
    for (var i = 0; i < destinations.length; i++) {
	destination = destinations.item(i);
	station_name = destination.evaluate("ancestor::station/name/text()").item(0).nodeValue.replace(/\'/g,'\'\'');
	
	if (station_name == "San Francisco Int''l Airport") {
	    station_name = "SF Airport";
	}
	
	eta = destination.evaluate("ancestor::eta/estimate/text()").item(0).nodeValue;
	destination_name = destination.nodeValue.replace(/\'/g,'\'\'');
	
	//	    log("station: " + station_name + "; destination: " + destination_name);
	
	if (false) {
	    log("INSERT INTO destination(station,destination,eta)" +
                "VALUES ('" + station_name + "' , '" + destination_name + "' , '" + eta + "')");
	}
	
	try {
	    db.exec("INSERT INTO destination(station,destination,eta)" +
                    "VALUES ('" + station_name + "' , '" + destination_name + "' , '" + eta + "')");
	}
	catch(e) {
	    log("error: could not insert destination:" + e);
	}
	
        /* exactly one of the following INSERT statements will actually do an insert, but 
               we don't know which for any particular pair, so we have to try both. */
	var insert_sql;

	insert_sql = "INSERT INTO d_before(from_station,final_destination,distance) " +
            "     SELECT station_a.abbr, station_b.abbr,1         " +
            "       FROM adjacent                                 " +
            " INNER JOIN station station_a                        " +
            "         ON station_a.abbr = station_a               " +
            " INNER JOIN station station_b                        " +
            "         ON station_b.abbr = station_b               " +
            "        AND (station_a.name = '"+ station_name + "') " +
            "        AND (station_b.name = '"+ destination_name + "')";
	try {
            db.exec(insert_sql);
	}
	catch(e) {
	    log("error: could not insert d_before(1):" + e);
	    log(insert_sql);
	    break;
	}

	insert_sql = "INSERT INTO d_before(final_destination,from_station,distance) " +
            "     SELECT station_a.abbr, station_b.abbr,1         " + 
            "       FROM adjacent                                 " +
            " INNER JOIN station station_a                        " +
            "         ON station_a.abbr = station_a               " +
            " INNER JOIN station station_b                        " +
            "         ON station_b.abbr = station_b               " +
            "        AND (station_b.name = '"+ station_name + "') " +
            "        AND (station_a.name = '"+ destination_name + "')";
	try {
            db.exec(insert_sql);
	}
	catch(e) {
	    log("error: could not insert d_before(2):" + e);
	    log(insert_sql);
	    break;
	}
	
    }

    /* populate d-before relation (recursive definition) */
    /* ('recursive' in the sense of the definition of d-before, not the implementation). */
    var new_count = 0;
    var iteration = 0;

    log("doing recursive case d_before()");
    do {

	var existing_count = new_count;
	var new_count_q = db.query("SELECT count(*) AS ct FROM d_before;");
	var new_count_row = new_count_q.getRow();
	new_count = new_count_row['ct'];
	    
	var query_a = "" +
"INSERT INTO d_before (from_station,final_destination,distance) \n"+
"     SELECT adjacent.station_b,adj.final_destination,(adj.distance + 1)\n"+
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
"        AND existing.final_destination IS NULL";

	// <debug support>
	iteration++;
	if (iteration == 0) {
	    log(query_a);
	    break;
	}
	// </debug support>
	try {
	    db.exec(query_a);
	}
	catch(e) {
	    log("error: could not insert d_before:" + e);
	}

	query_b = ""+
"INSERT INTO d_before (from_station,final_destination,distance)  \n"+
"     SELECT adjacent.station_a,adj.final_destination,adj.distance + 1\n"+
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
"        AND existing.final_destination IS NULL";

	// <debug support>
	iteration++;
	if (iteration == 0) {
	    log(query_a);
	    log(query_b);
	    break;
	}
	// </debug support>

	try {
	    db.exec(query_b);
	}
	catch(e) {
	    log("error: could not insert d_before:" + e);
	}

    } while (existing_count < new_count);

    log("done with recursive case d_before()");
}

    function update_etas() {
	log("update etas..");
	
	reload_etas();
	
	update_etas_timer.reset();
    }


function reload_etas() {

    initDB();

    var from_station = preferences.start_station.value;
    var to_station = preferences.end_station.value;

    // remove old messages from barttable.
    content_to_remove = table_data_frame.evaluate("frame");
    for (var i = 0; i < content_to_remove.length; i++) {
	table_data_frame.removeChild(content_to_remove.item(i));
    }
    table_data_frame.home();
    vOffset = 0;

    var station_name_query = ""+
	"SELECT A.abbr AS A_abbr,B.abbr AS B_abbr " +
         " FROM station A " +
    "INNER JOIN station B ON (A.name='"+from_station+"') AND (B.name='"+to_station+"')";

    var station_name_result = db.query(station_name_query);
    var station_name_row = station_name_result.getRow();
    var station_a_abbr = station_name_row['A_abbr'];
    var station_b_abbr = station_name_row['B_abbr'];

    var find_q = ""+
"SELECT A_station.name AS from_station,A_bound_to.name AS bound_to1,A_line_from.color,"+
"       B_station.name AS transfer_at,"+
"       D_bound_to.name AS bound_to2,D_station.name AS final_destination,"+
"       C_line_from.color,"+
"       (A.distance - B.distance) + (C.distance - D.distance)      "+
"      FROM d_before A    "+
" INNER JOIN d_before B   "+
"        ON (A.final_destination = B.final_destination)  "+
"       AND (A.from_station <> B.from_station)"+
" INNER JOIN station A_station"+
"        ON A_station.abbr = A.from_station"+
" INNER JOIN station A_bound_to"+
"        ON A_bound_to.abbr = A.final_destination"+
" INNER JOIN d_before C            "+
"        ON (B.from_station = C.from_station) "+
" INNER JOIN d_before D     "+
"        ON (C.final_destination = D.final_destination)     "+
"       AND (C.from_station <> D.from_station)"+
" INNER JOIN station B_station"+
"        ON B_station.abbr = B.from_station"+
" INNER JOIN line A_line_from       "+
"        ON (A_line_from.station = A.from_station)"+
" INNER JOIN line A_line_destination       "+
"        ON (A_line_destination.station = A.final_destination)"+
"       AND (A_line_from.color = A_line_destination.color)"+
" INNER JOIN line B_line_from"+
"        ON (B_line_from.station = B.from_station)   "+
"       AND (A_line_from.color = B_line_from.color)"+
" INNER JOIN line B_line_destination       "+
"        ON (B_line_destination.station = B.final_destination)"+
"       AND (B_line_from.color = B_line_destination.color)"+
" INNER JOIN line C_line_from           "+
"        ON (C_line_from.station = C.from_station)"+
" INNER JOIN line C_line_destination           "+
"        ON (C_line_destination.station = C.final_destination)"+
"       AND (C_line_from.color = C_line_destination.color)"+
" INNER JOIN line D_line        "+
"        ON (D_line.station = D.from_station)  "+
"       AND (C_line_from.color = D_line.color)   "+
" INNER JOIN station D_station"+
"        ON D_station.abbr = D.from_station"+
" INNER JOIN station D_bound_to"+
"        ON D_bound_to.abbr = D.final_destination"+
"     WHERE A.from_station = '"+station_a_abbr+"'"+
"       AND D.from_station = '"+station_b_abbr+"'"+
"       AND (A.distance > B.distance)"+ 
"       AND (C.distance > D.distance) "+
"  ORDER BY (A.distance - B.distance) + (C.distance - D.distance)"+
" LIMIT 10;";

    var find_result = db.query(find_q);
    var top_row = find_result.getRow();
    var top_from_station = top_row['from_station'];
    var top_bound_to1 = top_row['bound_to1'];
    var top_transfer_at = top_row['transfer_at'];
    var top_bound_to2 = top_row['bound_to2'];
    var top_final_destination = top_row['final_destination'];

    if (top_bound_to1 != top_bound_to2) {
	log("Leaving from " + top_from_station + ", take the " + top_bound_to1 + "-bound train and get off at " + top_transfer_at + ". Then, take the " + top_bound_to2 + "-bound train to " + top_final_destination + ".");
    }
    else {
	log("Leaving from " + top_from_station + ", take the " + top_bound_to1 + "-bound train and get off at " + top_final_destination + ".");
    }

    bart_row = new bartStationMessage("Leaving from " + top_from_station + ",");
    table_data_frame.appendChild(bart_row);

    bart_row = new bartStationMessage("Take the " + top_bound_to1 + "-bound train.");
    table_data_frame.appendChild(bart_row);

    var xpath1 = "string(/root/station[name='"+top_from_station+"']/eta[destination='"+top_bound_to1+"']/estimate)";
    estimate = bartEtaDoc.evaluate(xpath1);
    bart_row = new bartStationMessage("(" + estimate + ")");
    table_data_frame.appendChild(bart_row);

    if (top_bound_to1 != top_bound_to2) {
	bart_row = new bartStationMessage("Get off at: " + top_transfer_at + ".");
	table_data_frame.appendChild(bart_row);

	bart_row = new bartStationMessage("Then, take the " + top_bound_to2 + " train.");
	table_data_frame.appendChild(bart_row);

	var xpath2 = "string(/root/station[name='"+top_transfer_at+"']/eta[destination='"+top_bound_to2+"']/estimate)";
	estimate = bartEtaDoc.evaluate(xpath2);
	bart_row = new bartStationMessage("(" + estimate + ")");
	table_data_frame.appendChild(bart_row);
    }


    bart_row = new bartStationMessage("and get off at: " + top_final_destination + ".");
    table_data_frame.appendChild(bart_row);
}

function about() {
    alert("By Eugene Koontz (ekoontz@hiro-tan.org)");
}

function bartStationMessage( text ) {
    var obj = new Frame( );
    
    obj.symbol = null;
    obj.fullName = null;
    obj.change = 0;
    obj.changePercent = 0;

    obj.width = 450;
    obj.height = 28;
    obj.hOffset = 30;
    obj.vOffset = vOffset;
    vOffset += 15; // increment global
    obj.text = new Text( );
    obj.text.style.fontFamily = "sans-serif";
    obj.text.style.fontSize = "14px";
    obj.text.style.fontWeight = "bold";
    obj.text.hOffset = 14;
    obj.text.vOffset = 16;
    obj.text.data = text;
    obj.appendChild( obj.text );

    return obj;
}

