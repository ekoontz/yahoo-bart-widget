SELECT * FROM 
(     SELECT A_station.name AS from_station,
             A_bound_to.name AS bound_to1,
             A_line_from.color AS AB_color,
             NULL AS transfer_at,  
             NULL AS bound_to2,
             D_station.name AS final_destination,  
             C_line_from.color AS CD_color,
             (A.distance - B.distance) + (C.distance - D.distance) AS distance
        FROM d_before A   
  INNER JOIN d_before B    
          ON (A.final_destination = B.final_destination)   
         AND (A.from_station <> B.from_station) 
  INNER JOIN station A_station        
          ON A_station.abbr = A.from_station 
  INNER JOIN station A_bound_to  
          ON A_bound_to.abbr = A.final_destination
  INNER JOIN d_before C                 
          ON (B.from_station = C.from_station) 
  INNER JOIN d_before D         
          ON (C.final_destination = D.final_destination)   
         AND (C.from_station <> D.from_station) 
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
  INNER JOIN line C_line_from            
          ON (C_line_from.station = C.from_station)
  INNER JOIN line C_line_destination          
          ON (C_line_destination.station = C.final_destination) 
         AND (C_line_from.color = C_line_destination.color)
  INNER JOIN line D_line                
          ON (D_line.station = D.from_station)  
         AND (A_line_from.color = C_line_from.color)    
         AND (C_line_from.color = D_line.color)    
  INNER JOIN station D_station        
          ON D_station.abbr = D.from_station 
  INNER JOIN station D_bound_to        
          ON D_bound_to.abbr = D.final_destination     
       WHERE A.from_station = 'POWL'       
         AND D.from_station = 'ASHB'       
         AND (A.distance > B.distance)     
         AND (C.distance > D.distance)

UNION
      SELECT A_station.name AS from_station,
             A_bound_to.name AS bound_to1,
             A_line_from.color,       
             B_station.name AS transfer_at,  
             D_bound_to.name AS bound_to2,
             D_station.name AS final_destination,  
             C_line_from.color,      
             (A.distance - B.distance) + (C.distance - D.distance)         
        FROM d_before A   
  INNER JOIN d_before B    
          ON (A.final_destination = B.final_destination)   
         AND (A.from_station <> B.from_station) 
  INNER JOIN station A_station        
          ON A_station.abbr = A.from_station 
  INNER JOIN station A_bound_to  
          ON A_bound_to.abbr = A.final_destination
  INNER JOIN d_before C                 
          ON (B.from_station = C.from_station) 
  INNER JOIN d_before D         
          ON (C.final_destination = D.final_destination)   
         AND (C.from_station <> D.from_station) 
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
  INNER JOIN line C_line_from            
          ON (C_line_from.station = C.from_station)
         AND ((C_line_from.station = '12TH')
          OR  (C_line_from.station = '19TH')
	  OR  (C_line_from.station = 'BALB')
	  OR  (C_line_from.station = 'BAYF'))
  INNER JOIN line C_line_destination          
          ON (C_line_destination.station = C.final_destination) 
         AND (C_line_from.color = C_line_destination.color)
  INNER JOIN line D_line                
          ON (D_line.station = D.from_station)  
         AND (A_line_from.color != C_line_from.color)    
         AND (C_line_from.color = D_line.color)    
  INNER JOIN station D_station        
          ON D_station.abbr = D.from_station 
  INNER JOIN station D_bound_to        
          ON D_bound_to.abbr = D.final_destination     
       WHERE A.from_station = 'POWL'       
         AND D.from_station = 'ASHB'       
         AND (A.distance > B.distance)     
         AND (C.distance > D.distance) )
    ORDER BY A_line_from.color = C_line_from.color DESC,
            (A.distance - B.distance) + (C.distance - D.distance)






