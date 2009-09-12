SELECT A.from_station AS from_station,A.final_destination AS bound_to1,A_line_from.color,
       B.from_station AS transfer_at,D.final_destination AS bound_to2,D.from_station AS final_destination,
       C_line_from.color,(A.distance - B.distance) + (C.distance - D.distance)      
      FROM d_before A    
INNER JOIN d_before B   
        ON (A.final_destination = B.final_destination)  
       AND (A.from_station <> B.from_station)
INNER JOIN d_before C            
        ON (B.from_station = C.from_station) 
INNER JOIN d_before D     
        ON (C.final_destination = D.final_destination)     
       AND (C.from_station <> D.from_station)
INNER JOIN line A_line_from       
        ON (A_line_from.station = A.from_station)
INNER JOIN line A_line_destination       
        ON (A_line_destination.station = A.final_destination)
       AND (A_line_from.color = A_line_destination.color)
INNER JOIN line B_line_from
        ON (B_line_from.station = B.from_station)   
       AND (A_line_from.color = B_line_from.color)
INNER JOIN line B_line_destination       
        ON (B_line_destination.station = B.final_destination)
       AND (B_line_from.color = B_line_destination.color)
INNER JOIN line C_line_from           
        ON (C_line_from.station = C.from_station)
INNER JOIN line C_line_destination           
        ON (C_line_destination.station = C.final_destination)
       AND (C_line_from.color = C_line_destination.color)
INNER JOIN line D_line        
        ON (D_line.station = D.from_station)  
       AND (C_line_from.color = D_line.color)   
     WHERE A.from_station = 'POWL'    
       AND D.from_station = 'ASHB'  
       AND (A.distance > B.distance) 
       AND (C.distance > D.distance) 
  ORDER BY (A.distance - B.distance) + (C.distance - D.distance)
LIMIT 10;
