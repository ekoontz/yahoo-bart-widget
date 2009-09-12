#!/usr/bin/perl -w
# turn a csv file (of stops) to a sql file of inserts (into tmp_adjacent table)

my $prev = "";
my $current = "";

$color = shift;

while(<>) {
    chomp;
    if ($_) {
	print "INSERT INTO line(color,station) SELECT '$color','$_';\n";
    }
}
