  SELECT A_station.name AS from_station,
         A_bound_to.name AS bound_to1,
         A_line_from.color AS AB_color,       
         B_station.name AS transfer_at,  
         NULL AS bound_to2,
         B.from_station AS final_destination,
         A_line_from.color AS CD_color,
         (A.distance - B.distance) AS AB_distance,
	 0 AS CD_distance
        FROM d_before A   
  INNER JOIN d_before B    
          ON (A.final_destination = B.final_destination)   
         AND (A.from_station <> B.from_station) 
  INNER JOIN station A_station        
          ON A_station.abbr = A.from_station 
  INNER JOIN station A_bound_to  
          ON A_bound_to.abbr = A.final_destination
  INNER JOIN station B_station   
          ON B_station.abbr = B.from_station 
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
       WHERE 
       A.from_station = 'ROCK' AND      
--         AND B.from_station = 'ORIN'       
 (A_line_from.color = B_line_from.color)
         AND (A.distance > B.distance) ;