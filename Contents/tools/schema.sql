DROP TABLE IF EXISTS adjacent;
CREATE TABLE adjacent (station_a TEXT, station_b TEXT);

DROP TABLE IF EXISTS d_before;
CREATE TABLE d_before (from_station TEXT,final_destination TEXT, distance INTEGER);

DROP TABLE IF EXISTS destination;
CREATE TABLE destination (station TEXT,destination TEXT, eta TEXT);

DROP TABLE IF EXISTS line;
CREATE TABLE line (color char(10), station CHAR(4));

DROP TABLE IF EXISTS station;
CREATE TABLE station (name TEXT,abbr CHAR(4) PRIMARY KEY);
