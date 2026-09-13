this.onEnterFrame = function()
{
   if(this.getBytesLoaded() >= this.getBytesTotal())
   {
      delete this.onEnterFrame;
      play();
   }
};
