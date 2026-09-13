mausdelta = - d_maus();
woistdieMaus();
if(_root.buttonflag != true)
{
   if(gridflag == true)
   {
      if(mausdelta < 1e-8 and _root.maskenflag != "maskegesetzt")
      {
         _root.leuchtmaske.gotoAndPlay(2);
      }
      if(delta < 3e-7 and _root.stillstandsflag != "filmlaeuft" and _root.schongelaufen != "schongelaufen")
      {
         _root.stillstandsmovie.gotoAndPlay(2);
      }
      if(1 < delta)
      {
         _root.stillstandsmovie.gotoAndStop(1);
         _root.schongelaufen = "nochmallaufen";
      }
   }
   if(funktionen == true)
   {
      fake_var = "x_y.koord: " add random(9) add random(9) add random(9) add random(9);
      constante1 += Math.round((0.05 + mausdelta) * 10000) / 10000;
      funktion_zeichnen();
      main_zz();
      pegel();
   }
}
_root.test = _root.mausi[0];
