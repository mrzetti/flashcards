function fadeOut()
{
   trace("FADE OUT");
   this.onEnterFrame = function()
   {
      this.snd.setVolume(this.snd.getVolume() - this.fadeSteps);
      if(this.snd.getVolume() <= 0)
      {
         this.snd.setVolume(0);
         this.snd.stop();
         delete this.onEnterFrame;
      }
   };
}
function fadeIn()
{
   trace("FADE IN");
   this.onEnterFrame = function()
   {
      this.snd.setVolume(this.snd.getVolume() + this.fadeSteps);
      if(this.snd.getVolume() >= 30)
      {
         this.snd.setVolume(30);
         delete this.onEnterFrame;
      }
   };
}
