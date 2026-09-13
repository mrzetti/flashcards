getUrl("FSCommand:allowscale", "false");
_root.loadscale = _root.getBytesLoaded() / _root.getBytesTotal() * 100;
if(_root.loadscale == 100)
{
   gotoAndPlay(3);
}
