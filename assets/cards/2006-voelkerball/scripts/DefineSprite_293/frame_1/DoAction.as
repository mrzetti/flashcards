function sendform()
{
   if(valMail(form1.text))
   {
      submitForm();
   }
   else
   {
      form1.text = "Bitte eintragen!";
   }
}
function submitForm()
{
   delete this.onEnterFrame;
   myURL = "http://myprofile.universal-music.de/interface/web_subscribe.php";
   myURL += "?_core_aktion_id=10529";
   myURL += "&_core_action=subscribe";
   myURL += "&_core_subscribe_desc=voelkerball_ecard_deutsch";
   myURL += "&_core_url_redirect=NO";
   myURL += "&_core_mandatory[]=pers_email";
   myURL += "&pers_email=" + form1.text;
   myURL += "&listname[]=rammstein";
   myURL += "&__0818__=" + random(2000) + random(2000) + random(2000);
   trace(myURL);
   rVars = new LoadVars();
   sVars = new LoadVars();
   sVars.sendAndLoad(myURL,rVars,"GET");
   rVars.onLoad = function(success)
   {
      if(success)
      {
         if(Number(rVars.done) == 1)
         {
            gotoAndStop("SUCCESS");
         }
         else
         {
            gotoAndStop("ERROR");
         }
      }
      else
      {
         gotoAndStop("ERROR");
         play();
      }
   };
   trace("SUBMIT");
   gotoAndStop("sending");
}
function valMail(mail)
{
   if(mail.indexOf(" ") == -1 && mail.indexOf("@") > 0 && mail.lastIndexOf(".") > 1 + mail.indexOf("@") && mail.lastIndexOf(".") != mail.length - 2 && mail.lastIndexOf(".") != mail.length - 1)
   {
      return true;
   }
   return false;
}
