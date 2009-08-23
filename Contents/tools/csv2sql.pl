#!/usr/bin/perl -w
# turn a csv file (of stops) to a sql file of inserts (into tmp_adjacent table)

my $prev = "";
my $current = "";

while(<>) {
    @parts = split(",");
    $current = $parts[3];
    if ($prev ne "") {
	if ($prev ne $current) {
	    print "INSERT INTO tmp_adjacent (station_a,station_b) VALUES ('$prev','$current');\n";
	}
	else {
	    print "WTF: $_";
	}
    }
    $prev = $current;
}
