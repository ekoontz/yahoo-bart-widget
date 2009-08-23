#!/usr/bin/perl -w
# turn a csv file (of stops) to a sql file of inserts (into tmp_adjacent table)

my $prev = "";
my $current = "";

while(<>) {
    @parts = split(",");
    $current = $parts[3];
    $index = $parts[4];
    if (($index ne "1") && ($current ne "stop_id")) {
	print "INSERT INTO adjacent (station_a,station_b) SELECT '$prev','$current' WHERE '$prev' < '$current';\n";
    }
    $prev = $current;
}
