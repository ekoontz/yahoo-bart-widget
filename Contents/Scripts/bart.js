log("reading 'bart_eta.xml'");
var vitalityDoc = XMLDOM.parse( filesystem.readFile( "bart_eta.xml" ) );
log("finished reading 'bart_eta.xml'");

log("opening bart database.");
bartDB = new SQLite( );
bartDB.open( system.widgetDataFolder + "/bart.db" );
log("finished reading bart database.");

table_data_frame = widget.getElementById("barttable");

bart_row = new bartRow("Ashby station");
bart_row.vOffset = 30;
table_data_frame.appendChild(bart_row);

bart_row = new bartRow("Powell station");
bart_row.vOffset = 45;
table_data_frame.appendChild(bart_row);

function initialize() {
}

function about() {
    alert("By Eugene Koontz (ekoontz@hiro-tan.org)");
}

function bartRow( text ) {
    var obj = new Frame( );
    
    obj.symbol = null;
    obj.fullName = null;
    obj.change = 0;
    obj.changePercent = 0;

    obj.width = 200;
    obj.height = 28;
    obj.hOffset = 30;
    
    obj.stockSymbol = new Text( );
    obj.stockSymbol.style.fontFamily = "'Arial Black'";
    obj.stockSymbol.style.fontSize = "14px";
    obj.stockSymbol.style.color = "#00ff00";
    obj.stockSymbol.hOffset = 14;
    obj.stockSymbol.vOffset = 16;
    obj.stockSymbol.data = text;
    obj.appendChild( obj.stockSymbol );

    return obj;
}

