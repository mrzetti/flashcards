function initNavi()
{
   trace("initNavi");
   a = new Array("mcBtnReplay","mcBtnInfo","mcBtnPreview","mcBtnSend","mcBtnWin","mcBtnGallery","mcBtnDownload");
}
function switchNavi(arg)
{
   i = 0;
   while(i < a.length)
   {
      if(a[arg] == a[i])
      {
         this[a[i]].gotoAndPlay("active");
         mcContent.activeMenu = a[arg];
         if(mcContent._currentframe == 1 && a[arg] != "mcBtnGallery")
         {
            mcContent.gotoAndPlay("show");
         }
         else if(mcContent._currentframe != 1 && a[arg] != "mcBtnGallery")
         {
            mcContent.gotoAndPlay("setInhalt");
         }
         if(mcContent._currentframe == 31 && a[arg] == "mcBtnGallery")
         {
            mcContent.gotoAndPlay("hide");
         }
      }
      else
      {
         this[a[i]].gotoAndStop(1);
      }
      i++;
   }
}
function switchGallery(arg)
{
   if(this.mcBtnGallery._currentframe == 1)
   {
      this.switchNavi(5);
   }
   mcGalleryImages.attachImage(arg);
}
initNavi();
