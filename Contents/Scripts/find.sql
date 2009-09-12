SELECT A.*,
       B.*,
       C.*,
       D.*,
       A.distance - B.distance,
       C.distance - D.distance
         FROM d_before A 
   INNER JOIN station A_name
           ON (A.from_station = A_name.abbr)
   INNER JOIN station A_dest
           ON (A.final_destination = A_dest.abbr)
   INNER JOIN d_before B
           ON (A.final_destination = B.final_destination) 
   INNER JOIN station B_name
           ON (B.from_station = B_name.abbr)
   INNER JOIN d_before C
           ON (B.from_station = C.from_station)
   INNER JOIN station C_name
           ON (C.final_destination = C_name.abbr)
   INNER JOIN d_before D
           ON (C.final_destination = D.final_destination) 
   INNER JOIN station D_name
           ON (D.from_station = D_name.abbr)
        WHERE (A_name.name = 'Powell St.')
	  AND (D_name.name = 'Ashby')
          AND (A.distance > B.distance)
          AND (C.distance > D.distance)
	  AND B.from_station IN ('MCAR','12TH','BALB','BAYF','SANB')
     ORDER BY (A.distance - B.distance) + (C.distance - D.distance);








