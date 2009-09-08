    SELECT adjacent.station_b,adj.final_destination 
       FROM adjacent  
 INNER JOIN d_before adj 
         ON (station_a = adj.from_station)
 INNER JOIN station new  
         ON new.abbr = station_b  
 INNER JOIN station dest  
         ON dest.abbr = adj.final_destination 
 INNER JOIN destination  
         ON dest.name = destination.destination 
        AND destination.station = new.name 
  LEFT JOIN d_before existing 
         ON existing.from_station = adjacent.station_b 
        AND existing.final_destination = adj.final_destination 
      WHERE existing.from_station IS NULL  
        AND existing.final_destination IS NULL; 

     SELECT adjacent.station_a,adj.final_destination 
       FROM adjacent  
 INNER JOIN d_before adj 
         ON (station_b = adj.from_station) 
 INNER JOIN station new  
         ON new.abbr = station_a  
 INNER JOIN station dest  
         ON dest.abbr = adj.final_destination 
 INNER JOIN destination  
         ON dest.name = destination.destination 
        AND destination.station = new.name 
  LEFT JOIN d_before existing 
         ON existing.from_station = adjacent.station_a 
        AND existing.final_destination = adj.final_destination 
      WHERE existing.from_station IS NULL  
        AND existing.final_destination IS NULL; 
