this.onEnterFrame = function()
{
   ifFrameLoaded(9)
   {
      delete this.onEnterFrame;
      play();
   }
};
stop();
