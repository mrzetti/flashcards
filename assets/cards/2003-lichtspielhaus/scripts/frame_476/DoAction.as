function openvideo(s, t)
{
   trace("openvideo lädt " + s + " in player");
   pos = 1;
   vid_dir_1 = "flash/";
   vid_thumb_1 = t + ".swf";
   vid_datei_1 = s + ".swf";
   attach_thumb = "thumb";
   movie_modul.gotoAndStop("rein");
}
function opensound(s2)
{
   trace("opensound lädt " + s2 + " in player");
   playerG2.track = s2 + ".swf";
   playerG2.gotoAndPlay("auf");
}
fps = 25;
openvideo("trailer","t1");
stop();
