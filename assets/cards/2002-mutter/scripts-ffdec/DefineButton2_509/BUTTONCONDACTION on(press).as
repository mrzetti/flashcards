on(press){
   if(absname eq "")
   {
      tellTarget("error")
      {
         gotoAndStop("name");
      }
   }
   else if(abs eq "")
   {
      tellTarget("error")
      {
         gotoAndStop("abs");
      }
   }
   else if(em1 eq "")
   {
      tellTarget("error")
      {
         gotoAndStop("em");
      }
   }
   else
   {
      loadVariablesNum("http://php.rammstein.de/send_ecard.php",0,"GET");
      gotoAndStop(4);
   }
}
