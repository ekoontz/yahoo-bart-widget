.PHONY:lines

adjacent.sql:
	echo "DELETE FROM adjacent;" > $@
	perl csv2sql.pl ../../google_transit/stop_times.txt | sort | uniq  >> $@

lines.sql: blue.sql green.sql red.sql orange.sql  yellow.sql 
	echo "DELETE FROM line;" | bartdb
	cat $^ > $@

blue.sql:
	 cat blue.txt | ./lines.pl  blue > $@

green.sql:
	 cat green.txt | ./lines.pl  green > $@

orange.sql:
	 cat orange.txt | ./lines.pl  orange > $@

red.sql:
	 cat red.txt | ./lines.pl  red > $@

yellow.sql:
	 cat yellow.txt | ./lines.pl  yellow > $@
