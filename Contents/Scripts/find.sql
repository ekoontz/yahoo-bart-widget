SELECT A_name.name AS from_station,A.final_destination AS bound_to1,
       B.from_station AS transfer_at,C.final_destination AS bound_to2,D_name.name AS final_destination,
       (A.distance - B.distance) + (C.distance - D.distance)
         FROM d_before A 
   INNER JOIN d_before B
           ON (A.final_destination = B.final_destination) 
   LEFT JOIN station A_name
           ON (A.from_station = A_name.abbr)
   INNER JOIN d_before C
           ON (B.from_station = C.from_station)
   INNER JOIN d_before D
           ON (C.final_destination = D.final_destination) 
   INNER JOIN station D_name
           ON (D.from_station = D_name.abbr)
        WHERE A_name.name = 'Powell St.'
	  AND D_name.name = 'Ashby'
          AND (A.distance > B.distance)
          AND (C.distance > D.distance)
     ORDER BY (A.distance - B.distance) + (C.distance - D.distance);





