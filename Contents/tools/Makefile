.PHONY:

adjacent.sql:
	echo "DELETE FROM adjacent;" > $@
	perl csv2sql.pl ../../google_transit/stop_times.txt  | sort | uniq  >> $@

