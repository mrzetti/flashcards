ifFrameLoaded(LOADED_FRAME + 0)
{
   percent_loaded = int(LOADED_FRAME * 100 / total_frames);
   LOADED_FRAME = Number(LOADED_FRAME) + 1;
   setProperty("/BAR", _xscale, percent_loaded * value);
}
