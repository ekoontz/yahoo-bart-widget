CREATE TABLE adjacent (station_a TEXT, station_b TEXT);
CREATE TABLE d_before (from_station TEXT,final_destination TEXT, distance INTEGER);
CREATE TABLE destination (station TEXT,destination TEXT, eta TEXT);
CREATE TABLE line (color char(10), station CHAR(4));
CREATE TABLE station (name TEXT,abbr CHAR(4) PRIMARY KEY);
