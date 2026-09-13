function submitForm()
{
   rVars = new LoadVars();
   sVars = new LoadVars();
   sVars.cm_email = sf_from_email;
   sVars.sf_action = "sendMe";
   sVars.sf_messageflag = 1;
   sVars.sf_coreflag = 0;
   sVars.sf_from_email = sf_from_email;
   sVars.sf_to_email = sf_to_email;
   sVars.sf_message = sf_message;
   sVars.sf_subject = "// Rammstein // Völkerball //";
   sVars.sendAndLoad(url_enter,rVars,"GET");
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
function validate()
{
   val.ok = true;
   if(!valMail(sf_from_email) || sf_from_email == val.error)
   {
      sf_from_email = val.error;
      val.ok = false;
   }
   if(!valMail(sf_to_email) || sf_to_email == val.error)
   {
      sf_to_email = val.error;
      val.ok = false;
   }
   if(!sf_message || sf_message == val.error)
   {
      sf_message = val.error;
      val.ok = false;
   }
   if(val.ok)
   {
      submitForm();
   }
}
function valMail(mail)
{
   if(mail.indexOf(" ") == -1 && mail.indexOf("@") > 0 && mail.lastIndexOf(".") > 1 + mail.indexOf("@") && mail.lastIndexOf(".") != mail.length - 1)
   {
      return true;
   }
   return false;
}
val = new Object();
url_enter = "http://www.vertigo.fm/_specials/rammstein_voelkerball/scripts/send2Friend.php";
val.error = "Bitte eintragen";
sf_from_email = "Email-Adresse Sender";
sf_to_email = "Email-Adresse Empfänger";
sf_message = "Nachricht";
sf_messageflag = "0";
sf_subject = "// Rammstein // Völkerball //";
Selection.setFocus("user");
form1.onSetFocus = function()
{
   temp = sf_from_email;
   sf_from_email = "";
};
form1.onKillFocus = function()
{
   if(sf_from_email == "")
   {
      sf_from_email = temp;
   }
};
form2.onSetFocus = function()
{
   temp = sf_to_email;
   sf_to_email = "";
};
form2.onKillFocus = function()
{
   if(sf_to_email == "")
   {
      sf_to_email = temp;
   }
};
form3.onSetFocus = function()
{
   temp = sf_message;
   sf_message = "";
};
form3.onKillFocus = function()
{
   if(sf_message == "")
   {
      sf_message = temp;
   }
};
stop();
