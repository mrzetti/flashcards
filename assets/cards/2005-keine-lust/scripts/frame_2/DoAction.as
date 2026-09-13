MovieClip.prototype.bounce = function(bs, bg)
{
   var _loc1_ = this;
   if(typeof _loc1_.Binit == "undefined")
   {
      _loc1_.X = _loc1_._x;
      _loc1_.Y = _loc1_._y;
      _loc1_.Xorigin = _loc1_._x;
      _loc1_.Yorigin = _loc1_._y;
      _loc1_.syrupbounce = bs;
      _loc1_.greasebounce = bg;
      _loc1_.Xvel = "0";
      _loc1_.Yvel = "0";
      _loc1_.Binit = "y";
   }
   _loc1_.Xvel = _loc1_.Xvel * _loc1_.syrupbounce + (_loc1_.X - _loc1_._x) * _loc1_.greasebounce;
   _loc1_.Yvel = _loc1_.Yvel * _loc1_.syrupbounce + (_loc1_.Y - _loc1_._y) * _loc1_.greasebounce;
   _loc1_._x += _loc1_.Xvel;
   _loc1_._y += _loc1_.Yvel;
};
MovieClip.prototype.rotate = function(rs, rg)
{
   var _loc1_ = this;
   if(typeof _loc1_.Rinit == "undefined")
   {
      _loc1_.theRotation = 0;
      _loc1_.R = _loc1_._rotation;
      _loc1_.Rorigin = _loc1_._rotation;
      _loc1_.rotationsyrup = rs;
      _loc1_.rotationgrease = rg;
      _loc1_.speedR = "0";
      _loc1_.Rinit = "y";
   }
   _loc1_.speedR = _loc1_.speedR * _loc1_.rotationsyrup + (_loc1_.R - _loc1_.theRotation) * _loc1_.rotationgrease;
   _loc1_.theRotation += _loc1_.speedR;
   _loc1_._rotation = _loc1_.theRotation;
};
MovieClip.prototype.scale = function(ss, sg)
{
   var _loc1_ = this;
   if(typeof _loc1_.Sinit == "undefined")
   {
      _loc1_.W = _loc1_._xscale;
      _loc1_.H = _loc1_._yscale;
      _loc1_.Worigin = _loc1_._xscale;
      _loc1_.Horigin = _loc1_._yscale;
      _loc1_.sizesyrup = ss;
      _loc1_.sizegrease = sg;
      _loc1_.Wvel = "0";
      _loc1_.Hvel = "0";
      _loc1_.Sinit = "y";
   }
   _loc1_.Wvel = _loc1_.Wvel * _loc1_.sizesyrup + (_loc1_.W - _loc1_._xscale) * _loc1_.sizegrease;
   _loc1_.Hvel = _loc1_.Hvel * _loc1_.sizesyrup + (_loc1_.H - _loc1_._yscale) * _loc1_.sizegrease;
   _loc1_._xscale += _loc1_.Wvel;
   _loc1_._yscale += _loc1_.Hvel;
};
MovieClip.prototype.setColourOffset = function(r, g, b, a)
{
   var _loc1_ = this;
   _loc1_.redOffset = r;
   _loc1_.greenOffset = g;
   _loc1_.blueOffset = b;
   _loc1_.alphaOffset = a;
};
MovieClip.prototype.setColourPercent = function(r, g, b, a)
{
   var _loc1_ = this;
   _loc1_.redPercent = r;
   _loc1_.greenPercent = g;
   _loc1_.bluePercent = b;
   _loc1_.alphaPercent = a;
};
MovieClip.prototype.colour = function(cg)
{
   var _loc1_ = this;
   if(typeof _loc1_.Cinit == "undefined")
   {
      _loc1_.syrupcolor = 0;
      _loc1_.greasecolor = cg;
      _loc1_.redPercent = 100;
      _loc1_.greenPercent = 100;
      _loc1_.bluePercent = 100;
      _loc1_.alphaPercent = 100;
      _loc1_.redOffset = 0;
      _loc1_.greenOffset = 0;
      _loc1_.blueOffset = 0;
      _loc1_.alphaOffset = 0;
      _loc1_.reda = 100;
      _loc1_.greena = 100;
      _loc1_.bluea = 100;
      _loc1_.alphaa = 100;
      _loc1_.redvel = "0";
      _loc1_.greenvel = "0";
      _loc1_.bluevel = "0";
      _loc1_.alphavel = "0";
      _loc1_.redvela = "0";
      _loc1_.greenvela = "0";
      _loc1_.bluevela = "0";
      _loc1_.alphavela = "0";
      _loc1_.red = 0;
      _loc1_.green = 0;
      _loc1_.blue = 0;
      _loc1_.alpha = 0;
      _loc1_.colourObject = new Color(_loc1_);
      _loc1_.colourObjectTx = {};
      _loc1_.Cinit = "y";
   }
   _loc1_.redvel = _loc1_.redvel * _loc1_.syrupcolor + (_loc1_.redOffset - _loc1_.red) * _loc1_.greasecolor;
   _loc1_.greenvel = _loc1_.greenvel * _loc1_.syrupcolor + (_loc1_.greenOffset - _loc1_.green) * _loc1_.greasecolor;
   _loc1_.bluevel = _loc1_.bluevel * _loc1_.syrupcolor + (_loc1_.blueOffset - _loc1_.blue) * _loc1_.greasecolor;
   _loc1_.alphavel = _loc1_.alphavel * _loc1_.syrupcolor + (_loc1_.alphaOffset - _loc1_.alpha) * _loc1_.greasecolor;
   _loc1_.redvela = _loc1_.redvela * _loc1_.syrupcolor + (_loc1_.redPercent - _loc1_.reda) * _loc1_.greasecolor;
   _loc1_.greenvela = _loc1_.greenvela * _loc1_.syrupcolor + (_loc1_.greenPercent - _loc1_.greena) * _loc1_.greasecolor;
   _loc1_.bluevela = _loc1_.bluevela * _loc1_.syrupcolor + (_loc1_.bluePercent - _loc1_.bluea) * _loc1_.greasecolor;
   _loc1_.alphavela = _loc1_.alphavela * _loc1_.syrupcolor + (_loc1_.alphaPercent - _loc1_.alphaa) * _loc1_.greasecolor;
   _loc1_.red += _loc1_.redvel;
   _loc1_.green += _loc1_.greenvel;
   _loc1_.blue += _loc1_.bluevel;
   _loc1_.alpha += _loc1_.alphavel;
   _loc1_.reda += _loc1_.redvela;
   _loc1_.greena += _loc1_.greenvela;
   _loc1_.bluea += _loc1_.bluevela;
   _loc1_.alphaa += _loc1_.alphavela;
   _loc1_.colourObjectTx.ra = _loc1_.reda;
   _loc1_.colourObjectTx.rb = _loc1_.red;
   _loc1_.colourObjectTx.ga = _loc1_.greena;
   _loc1_.colourObjectTx.gb = _loc1_.green;
   _loc1_.colourObjectTx.ba = _loc1_.bluea;
   _loc1_.colourObjectTx.bb = _loc1_.blue;
   _loc1_.colourObjectTx.aa = _loc1_.alphaa;
   _loc1_.colourObjectTx.ab = _loc1_.alpha;
   _loc1_.colourObject.setTransform(_loc1_.colourObjectTx);
};
getUrl("FSCommand:fullscreen", "true");
getUrl("FSCommand:allowscale", "false");
/:navnavdestination = "intro";
