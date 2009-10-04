.PHONY:lines clean run

all: adjacent.sql lines.sql

adjacent.sql:
	echo "DELETE FROM adjacent;" > $@
	perl csv2sql.pl stop_times.txt | sort | uniq  >> $@

clean:
	-rm lines.sql adjacent.sql blue.sql green.sql orange.sql red.sql yellow.sql

run: adjacent.sql lines.sql
	echo "DELETE FROM line;" | bartdb
	cat $< > $@

lines.sql: blue.sql green.sql red.sql orange.sql  yellow.sql 

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
