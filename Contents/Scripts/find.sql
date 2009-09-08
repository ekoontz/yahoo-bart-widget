SELECT A.from_station AS from_station,A.final_destination AS bound_to1,
       B.from_station AS transfer_at,C.final_destination AS bound_to2,D.from_station AS final_destination,
       (A.distance - B.distance) + (C.distance - D.distance)
         FROM d_before A 
   INNER JOIN d_before B
           ON (A.final_destination = B.final_destination) 
   INNER JOIN d_before C
           ON (B.from_station = C.from_station)
   INNER JOIN d_before D
           ON (C.final_destination = D.final_destination) 
        WHERE A.from_station='POWL' AND D.from_station='ASHB'
          AND (A.distance > B.distance)
          AND (C.distance > D.distance)
     ORDER BY (A.distance - B.distance) + (C.distance - D.distance);





