<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet 
    xmlns="http://www.w3.org/1999/xhtml"
    xmlns:html="http://www.w3.org/1999/xhtml"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    version="1.0">

  <xsl:output method="xml" indent="yes" encoding="utf-8" omit-xml-declaration="yes"/>
  <-- (unfortunately this will not work because there is usually more than one train at a time going from a given destination). -->

  <!-- turn a bart_eta.xml file into a set of adjacency pairs based on the time estimates and destinations. -->
  <!-- the idea is that we can load the eta/estimate for stations with the same eta/destination and order them by the eta/estimate -->
  <!-- 
       e.g.
       destination station                      estimate
       =================================================
       SF Airport  12. St. Oakland City Center	5min		   
       SF Airport  MacArthur                    6min
       SF Airport  Rock Ridge                   7min
 ......
       You could infer from the above that 12 St. is adjacent to MacArthur, which is adjacent to Rock Ridge
        

       xpath ../bart_eta.xml "/root/station[eta/destination='SF Airport']/eta[destination='SF Airport']/estimate"


       (unfortunately this will not work because there is usually more than one train at a time going from a given destination).

     -->

  <xsl:template match="/">
    <xsl:apply-templates/>
  </xsl:template>

  <xsl:template match="station/

  <xsl:template match="*">
    <xsl:apply-templates/>
  </xsl:template>


</xsl:stylesheet>
