var db;
var coundown_to_update = 0;
var online = true;
//var online = false;
var bartEtaDoc;

function initDB() {
    try {
	log("opening bart database from file: " + system.widgetDataFolder + "/bart.db");
	db = new SQLite( );
	db.open( system.widgetDataFolder + "/bart.db" );
	log("..ok.");
    }
    catch (e) {
	log("exception opening database");
	throw(e);
    }

    var files = new Array(
	"tools/schema.sql",
	"tools/adjacent.sql",
	"tools/blue.sql",
	"tools/green.sql",
	"tools/orange.sql",
	"tools/red.sql",
	"tools/yellow.sql"
    );

    for (var i = 0; i < files.length; i++) {

	log("reading file: "+ files[i]);

	var sql_lines = filesystem.readFile(files[i],true);

	for (var j = 0; j < sql_lines.length; j++) {
	    try {
		db.exec(sql_lines[j]);
	    }
	    catch (e) {
		log("could not execute database setup command: '" + sql_lines[j] + "' (" + e + ")");
		throw(e);
	    }
	}
    }
    db.close();
}
    
    function reloadDB() {

	var status = bartWindow.getElementById("status");
	status.data = "updating BART info..";

	countdown_to_update = 120;

	// <get up-to-date BART eta info from bart.gov.>
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
		log("reading local 'bart_eta.xml' from : " + system.widgetDataFolder + "/bart_eta.xml");
		//	    bartEtaDoc = XMLDOM.parse( filesystem.readFile( "bart_eta.xml" ) );
		bartEtaDoc = XMLDOM.parse( filesystem.readFile(system.widgetDataFolder + "/bart_eta.xml"));
		log("..done.");
	    }
	    log("..ok.");
	}
	catch(e) {
	    log("exception reading bart_eta.xml: " + e);
	    throw(e);
	}
	// </get up-to-date BART eta info from bart.gov.>

	// the rest of this function populates
	// local database with BART eta info
	try {
	    db.open( system.widgetDataFolder + "/bart.db" );
	}
	catch(e) {
	    log("could not open db:" + e.errCode + ":" + e.errMsg);
	    throw(e);
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
    }
    catch (e) {
	log("could not create station tables:" + e.errCode + ":" + e.errMsg);
	throw(e);
    }
    try {
	db.exec("DELETE FROM station");
    }
    catch (e) {
	log("could not delete from station:" + e.errCode + ":" + e.errMsg);
	throw(e);
    }
    try {	
	db.exec("CREATE TABLE IF NOT EXISTS d_before (from_station TEXT,final_destination TEXT, distance INTEGER)");
    }
    catch (e) {
	log("could not create d_before:" + e.errCode + ":" + e.errMsg);
	throw(e);
    }
    try {
	db.exec("DELETE FROM d_before");

	db.exec("CREATE TABLE IF NOT EXISTS log (from_station TEXT,final_destination TEXT, distance INTEGER,station_a TEXT,station_b TEXT, iteration INTEGER)");
	db.exec("DELETE FROM log");

    }
    catch (e) {
	log("could not delete from d_before, or could not create log table, or could not delete from it" + e);
	throw(e);
    }
    try {
	db.exec("CREATE TABLE IF NOT EXISTS destination (station TEXT,destination TEXT, eta TEXT)");
    }
    catch (e) {
	log("could not create destination table:" + e.errCode + ":" + e.errMsg);
	throw(e);
    }
    try {
	db.exec("DELETE FROM destination");
    }
    catch (e) {
	log("could not delete from destination:" + e.errCode + ":" + e.errMsg);
	throw(e);
    }

    /* populate stations from server XML response. */
    stations = bartEtaDoc.evaluate( "/root/station" );

    log("found " + stations.length + " stations");

    for (var i = 0; i < stations.length; i++) {
	station = stations.item(i);
	station_name = station.evaluate("name[1]/text()").item(0).nodeValue;
	
	if (station_name == "San Francisco Int'l Airport") {
	    station_name = "SF Airport";
	}
	
	station_abbr = station.evaluate("abbr[1]/text()").item(0).nodeValue;
	station_name = station_name.replace(/\'/g,'\'\'');
	
	var insert_station_query = "INSERT INTO station (name,abbr) VALUES ('"+station_name+"','"+station_abbr+"')";
	
	try {
	    db.exec(insert_station_query);
	}
	catch(e) {
	    log("error: could not insert station:" + insert_station_query + " : " + e);
	    throw(e);
	}
    }

    log("doing initial case d_before()");

    /* populate d-before relation (base case) */
    destinations = bartEtaDoc.evaluate( "/root/station/eta/destination/text()" );

    for (var i = 0; i < destinations.length; i++) {
	destination = destinations.item(i);
	destination_name = destination.nodeValue.replace(/\'/g,'\'\'');

	/* some time in September, 2009, the BART
           map changed with respect to SF Airport and Millbrae:
           The XML feed does not show trains with a final destination
           of the Airport: instead it shows the destination
           'SFO/Millbrae', meaning the final destination is
           at least SF Airport, but that it might continue to 
           Millbrae from there (after 7pm Mon-Fri; all day Sat and Sun.). */
	if (destination_name == "SFO/Millbrae") {
	    destination_name = "SF Airport";
	}
	var insert_sql;

	insert_sql = "INSERT INTO d_before(from_station,final_destination,distance) " +
            "     SELECT station.abbr, station.abbr,0         " +
            "       FROM station " +
            "  LEFT JOIN d_before ON (d_before.from_station = station.abbr)" +
            "      WHERE (station.name = '"+ destination_name + "')" +
            "        AND (d_before.from_station IS NULL)";
	try {
            db.exec(insert_sql);
	}
	catch(e) {
	    log("error: could not insert d_before(1):" + e);
	    log(insert_sql);
	    break;
	}

    }

    for (var i = 0; i < destinations.length; i++) {
	destination = destinations.item(i);
	station_name = destination.evaluate("ancestor::station/name/text()").item(0).nodeValue.replace(/\'/g,'\'\'');
	
	if (station_name == "San Francisco Int''l Airport") {
	    station_name = "SF Airport";
	}

	eta = destination.evaluate("ancestor::eta/estimate/text()").item(0).nodeValue;
	destination_name = destination.nodeValue.replace(/\'/g,'\'\'');

	if (destination_name == "SFO/Millbrae") {
	    destination_name = "SF Airport";
	}

	try {
	    db.exec("INSERT INTO destination(station,destination,eta)" +
                    "VALUES ('" + station_name + "' , '" + destination_name + "' , '" + eta + "')");
	}
	catch(e) {
	    log("error: could not insert destination:" + e);
	}
	
	var insert_sql;

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
//	    log(insert_sql);
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

	new_count_q.dispose();
	    
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

	log("iteration: " + iteration + " : " + existing_count + " / " + new_count);

    } while (existing_count < new_count);

    log("done with recursive case d_before()");

	log("</reloadDB()>");

	status.data = "updated.";

}

    function update_etas() {
	log("update etas..");
	
	reload_etas();
	
	update_etas_timer.reset();
    }


    function reload_etas() {

	reloadDB();

	var from_station = preferences.start_station.value;
	var to_station = preferences.end_station.value;
	
	// remove old messages from barttable.
	
	to_station = to_station.replace(/\'/g,'\'\'');
	if (to_station == "San Francisco Int''l Airport") {
	    to_station = "SF Airport";
	}
	
	var station_name_query = ""+
	"SELECT A.abbr AS A_abbr,B.abbr AS B_abbr " +
         " FROM station A " +
    "INNER JOIN station B ON (A.name='"+from_station+"') AND (B.name='"+to_station+"')";

	var station_name_result;
	var station_name_row;
	
	try {
	    station_name_result = db.query(station_name_query);
	    station_name_row = station_name_result.getRow();
	}
	catch(e) {
	    throw("could not do station name query : " + station_name_query);
	}
	
	if (station_name_row == null) {
	    log("no stations found: your database is not populated with station information.");
	    throw("no stations found: your database is not populated with station information.");
	    
	}
	
	var station_a_abbr = station_name_row['A_abbr'];
	var station_b_abbr = station_name_row['B_abbr'];
	
	station_name_result.dispose();
	
	/* station_a_abbr, station_b_abbr */
	var find_q = ""+
	    "SELECT from_station,bound_to1,AB_color,"+
	    "       transfer_at,bound_to2,CD_color,"+
	    "       (AB_distance + CD_distance) AS distance,"+
	    "       final_destination"+
	    " FROM"+
	    "(    "+
	    "  SELECT A_station.name AS from_station,"+
	    "         A_bound_to.name AS bound_to1,"+
	    "         A_line_from.color AS AB_color, "+      
	    "         B_station.name AS transfer_at,  "+
	    "         NULL AS bound_to2,"+
	    "         B_station.name AS final_destination,"+
	    "         A_line_from.color AS CD_color,"+
	    "         (A.distance - B.distance) AS AB_distance,"+
	    "	 0 AS CD_distance"+
	    "        FROM d_before A   "+
	    "  INNER JOIN d_before B    "+
	    "          ON (A.final_destination = B.final_destination)   "+
	    "         AND (A.from_station <> B.from_station) "+
	    "  INNER JOIN station A_station        "+
	    "          ON A_station.abbr = A.from_station "+
	    "  INNER JOIN station A_bound_to  "+
	    "          ON A_bound_to.abbr = A.final_destination"+
	    "  INNER JOIN station B_station   "+
	    "          ON B_station.abbr = B.from_station "+
	    "  INNER JOIN line A_line_from          "+
	    "          ON (A_line_from.station = A.from_station) "+
	    "  INNER JOIN line A_line_destination            "+
	    "          ON (A_line_destination.station = A.final_destination)  "+
	    "         AND (A_line_from.color = A_line_destination.color)"+
	    "  INNER JOIN line B_line_from     "+
	    "          ON (B_line_from.station = B.from_station)        "+
	    "         AND (A_line_from.color = B_line_from.color) "+
	    "  INNER JOIN line B_line_destination           "+
	    "          ON (B_line_destination.station = B.final_destination)   "+
	    "         AND (B_line_from.color = B_line_destination.color) "+
	    "       WHERE A.from_station = '"+station_a_abbr+"'"+
	    "         AND B.from_station = '"+station_b_abbr+"'"+
	    "         AND (A_line_from.color = B_line_from.color)"+
	    "         AND (A.distance > B.distance) "+
	    "UNION"+
	    "  SELECT A_station.name AS from_station,"+
	    "         A_bound_to.name AS bound_to1,"+
	    "         A_line_from.color AS AB_color,"+
	    "         B_station.name AS transfer_at,  "+  
	    "         D_bound_to.name AS bound_to2,"+
	    "         D_station.name AS final_destination, "+
	    "         C_line_from.color AS CD_color,"+
	    "         (A.distance - B.distance) AS AB_distance,"+
	    "         (C.distance - D.distance) AS CD_distance"+
	    "       FROM d_before A     "+
	    " INNER JOIN d_before B       "+
	    "         ON (A.final_destination = B.final_destination)  "+
	    "        AND (A.from_station <> B.from_station) "+
	    " INNER JOIN station A_station     "+
	    "         ON A_station.abbr = A.from_station"+
	    " INNER JOIN station A_bound_to     "+
	    "         ON A_bound_to.abbr = A.final_destination"+
	    " INNER JOIN d_before C              "+
	    "         ON (B.from_station = C.from_station) "+
	    " INNER JOIN d_before D          "+
	    "         ON (C.final_destination = D.final_destination)            "+
	    "        AND (C.from_station <> D.from_station) "+
	    " INNER JOIN station B_station      "+
	    "         ON B_station.abbr = B.from_station"+
	    " INNER JOIN line A_line_from          "+
	    "         ON (A_line_from.station = A.from_station)"+
	    " INNER JOIN line A_line_destination"+
	    "         ON (A_line_destination.station = A.final_destination)  "+
	    "        AND (A_line_from.color = A_line_destination.color) "+
	    " INNER JOIN line B_line_from        "+
	    "         ON (B_line_from.station = B.from_station) "+
	    "        AND (A_line_from.color = B_line_from.color) "+
	    " INNER JOIN line B_line_destination "+
	    "         ON (B_line_destination.station = B.final_destination)"+
	    "        AND (B_line_from.color = B_line_destination.color) "+
	    " INNER JOIN line C_line_from "+
	    "         ON (C_line_from.station = C.from_station)  "+
	    /* do we need DALY (Daly City) in here? (it is called
a transfer station but there is no reason to you would want to transfer there,
so it probably is not needed.)
*/
	"        AND ((C_line_from.station = '12TH')"+
	    "         OR  (C_line_from.station = '19TH')"+
	    "	 OR  (C_line_from.station = 'BALB')"+
	    "	 OR  (C_line_from.station = 'BAYF'))"+
	    " INNER JOIN line C_line_destination "+
	    "         ON (C_line_destination.station = C.final_destination) "+
	    "        AND (C_line_from.color = C_line_destination.color)"+
	    " INNER JOIN line D_line"+
	    "         ON (D_line.station = D.from_station)"+
	    "        AND (C_line_from.color = D_line.color)"+
	    " INNER JOIN station D_station"+
	    "         ON D_station.abbr = D.from_station"+
	    " INNER JOIN station D_bound_to"+
	    "         ON D_bound_to.abbr = D.final_destination"+
	    "      WHERE A.from_station = '"+station_a_abbr+"'"+
	    "        AND D.from_station = '"+station_b_abbr+"'"+
	    "        AND AB_color <> CD_color"+
	    "        AND (A.distance > B.distance) "+
	    "        AND (C.distance > D.distance) "+
	    ")"+
	    "   ORDER BY AB_color = CD_color DESC,"+
	    "            distance ASC;";
	
	//    log(find_q);

	var find_result = db.query(find_q);
	
	for(var i = 1; i < 3; i++) {
	    var top_row = find_result.getRow();
	    var top_from_station;
	    
	    if (!top_row) {
		log("no more routes found.");
		break;
	    }
	    
	    
	    top_from_station = top_row['from_station'];
	    
	    var top_bound_to1 = top_row['bound_to1'];
	    var top_transfer_at = top_row['transfer_at'];
	    var top_bound_to2 = top_row['bound_to2'];
	    var top_final_destination = top_row['final_destination'];
	    var ab_train_color = top_row['AB_color'];
	    var cd_train_color = top_row['CD_color'];
	    
	    if (top_bound_to2 != null) {
		log("Leaving from " + top_from_station + ", take the " + top_bound_to1 + "-bound train and get off at " + top_transfer_at + ". Then, take the " + top_bound_to2 + "-bound train to " + top_final_destination + ".");
	    }
	    else {
		log("Leaving from " + top_from_station + ", take the " + top_bound_to1 + "-bound train and get off at " + top_final_destination + ".");
	    }
	    
	    var b_line_1 = bartWindow.getElementById("b_line_"+i+"_1");
	    if (top_bound_to1) {
		b_line_1.data = top_bound_to1 + " ->";
	    }
	    else {
		b_line_1.data = "";
	    }
	    
	    var b_line_2 = bartWindow.getElementById("b_line_"+i+"_2");
	    if (top_bound_to2) {
		b_line_2.data = top_bound_to2 + " ->";
	    }
	    else {
		b_line_2.data = "";
	    }
	    
	    b_line_1.style.color = "#ffffff";
	    if (ab_train_color == "yellow") {
		b_line_1.style.color = "blue";
	    }
	    if (ab_train_color == "orange") {
		b_line_1.style.color = "blue";
	    }
	    
	    b_line_2.style.color = "#ffffff";
	    if (cd_train_color == "yellow") {
		b_line_2.style.color = "blue";
	    }
	    if (cd_train_color == "orange") {
		b_line_2.style.color = "blue";
	    }
	    
	    if (top_bound_to1 == 'SF Airport') {
		top_bound_to1 = "SFO/Millbrae";
	    }


	    var b_from_station = bartWindow.getElementById("b_starting_station"+i);
	    b_from_station.data = top_from_station;
	    
	    var b_to_station = bartWindow.getElementById("b_final_destination"+i);
	    var top_final_destination_firstword = top_final_destination.replace(/ .*/,"");

	    b_to_station.data = top_final_destination_firstword;

	    var b_to_station_overflow = bartWindow.getElementById("b_final_destination"+i+"_overflow");
	    var top_final_destination_rest = top_final_destination.replace(/^[^ ]+/,"");
	    if (top_final_destination_rest != top_final_destination) 
		b_to_station_overflow.data = top_final_destination_rest;
	    
	    var b_transfer = bartWindow.getElementById("b_transfer_point"+i);
	    if (top_transfer_at != top_final_destination) {
		b_transfer.data = top_transfer_at;
	    }
	    else {
		b_transfer.data = "";
	    }
	    
	    var message;
	    if (top_bound_to2 != null) {
		message = top_bound_to1;
	    }
	    else {
		message = top_bound_to1;
	    }
	    
	    var bridge_b;
	    
	    bridge_b = bartWindow.getElementById("trip_"+i+"_leg_1");
	    bridge_b.style.background = ab_train_color;

	    bridge_b = bartWindow.getElementById("trip_"+i+"_leg_2");
	    bridge_b.style.background = cd_train_color;
	    
	    var xpath1 = "string(/root/station[name='"+top_from_station+"']/eta[destination='"+top_bound_to1+"']/estimate)";

	    log("eta xpath: " + xpath1);

	    estimate = bartEtaDoc.evaluate(xpath1);

	    var first = estimate.replace(/,.*/,"");
	    var others = estimate.replace(/^[^,]+,/,"");

	    if (others == estimate) {
		// in this case, there is only one train (no commas).
		others = "";
	    }

	    log("eta (first): " + first);
	    log("eta (others): " + others);

	    var estimate_textbox = bartWindow.getElementById("b_eta"+i);
	    estimate_textbox.data = first;

	    estimate_textbox = bartWindow.getElementById("b_eta"+i+"_rest");
	    estimate_textbox.data = others;
	    
	    // <get eta from transfer station to final destination.>
	    // (this is not currently displayed anywhere, so disabled.)
	    if (false) {
		if (top_transfer_at != top_final_destination) {
		    if (top_bound_to2 != null) {
			var xpath2 = "string(/root/station[name='"+top_transfer_at+"']/eta[destination='"+top_bound_to2+"']/estimate)";
			estimate = bartEtaDoc.evaluate(xpath2);
		    }
		}
	    }
	    // </get eta from transfer station to final destination.>
	}
	
	find_result.dispose();
	try {
	    db.close();
	}
	catch (e) {
    	    log("could not close db:" + e.errCode + ":" + e.errMsg);
	}
    }

    function update_status() {
	var status = bartWindow.getElementById("status");
	status.data = "update in : " + countdown_to_update + " secs.";

	countdown_to_update = countdown_to_update - 1;

	status_timer.reset();
    }
    
    function about() {
	alert("By Eugene Koontz (ekoontz@hiro-tan.org)");
    }


