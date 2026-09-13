function new_x(vari)
{
   return Math.round(xscale * vari * 1000) / 1000;
}
function new_y(vari)
{
   if(overflag == true)
   {
      return Math.round(yscale * Math.random(7) * Math.sin(vari + constante1) * 100) / 200;
   }
   return Math.round(yscale * Math.sin(vari + constante1 + mausdelta1) * 100) / 100;
}
function new_y2(vari)
{
   if(overflag == true)
   {
      return Math.round(yscale * Math.random(7) * Math.sin(vari + constante2) * 100) / 100;
   }
   return Math.round(0.8 * yscale * Math.cos(vari + constante2 + mausdelta2) * 100) / 100;
}
function remove_sin()
{
   while(1 < level)
   {
      removeMovieClip("line" add level);
      level -= 1;
   }
}
function funktion_zeichnen()
{
   remove_sin();
   k = 0;
   xold = new_x(k);
   yold = new_y(k);
   yold2 = new_y2(k);
   while(k < perioden * 2 * 3.141592653589793 + deltax)
   {
      x = new_x(k);
      y = new_y(k);
      attachMovie("line","line" + level,level);
      _root["line" + level]._x = off_x + x;
      _root["line" + level]._y = off_y + y;
      _root["line" + level]._alpha = _root.trans;
      _root["line" + level]._rotation = Math.atan2(yold - y,xold - x) * 180 / 3.141592653589793;
      _root["line" + level]._xscale = _root["line" + level]._yscale = Math.sqrt((xold - x) * (xold - x) + (yold - y) * (yold - y));
      level += 1;
      yold = y;
      yold2 = y2;
      xold = x;
      k += deltax;
   }
   level += points;
}
function d_maus()
{
   yscale = 4;
   x_m = _root.mausi[0];
   y_m = _root.mausi[1];
   delta = Math.sqrt((x_m_o - x_m) * (x_m_o - x_m) + (y_m_o - y_m) * (y_m_o - y_m));
   x_m_o = x_m;
   y_m_o = y_m;
   yscale += delta * 0.005;
   mausdif = Math.abs((mausdif - delta) / 20);
   dif2 = dif2 / 1.34 - mausdif / 11;
   return dif2;
}
function fkt_zz_y(vari)
{
   fucker = random(60);
   return dif2 * 2.1 * (Math.random() * Math.sin(fucker * vari) + fucker / 200 * Math.sin(200 * vari));
}
function main_zz()
{
   zz_x = zaehl;
   zz_y = Math.round(y_faktor * fkt_zz_y(zz_x * x_faktor));
   zz_malen();
   zz_balken();
   zaehl += 3;
   zz_x_alt = zz_x;
   zz_y_alt = zz_y;
   if(breite < zaehl)
   {
      zaehl = 0;
      zz_remove();
      var_l = zz_min;
      zz_x_alt = 0;
      zz_y_alt = 0;
   }
}
function zz_malen()
{
   attachMovie("gerade","gerade" + var_l,var_l);
   _root["gerade" + var_l]._x = x0 + zz_x;
   _root["gerade" + var_l]._y = y0 + zz_y;
   _root["gerade" + var_l]._alpha = _root.trans;
   _root["gerade" + var_l]._rotation = Math.atan2(zz_y_alt - zz_y,zz_x_alt - zz_x) * 180 / 3.141592653589793;
   _root["gerade" + var_l]._xscale = _root["gerade" + var_l]._yscale = Math.sqrt((zz_x_alt - zz_x) * (zz_x_alt - zz_x) + (zz_y_alt - zz_y) * (zz_y_alt - zz_y));
   var_l += 1;
}
function zz_remove()
{
   while(zz_min < var_l)
   {
      removeMovieClip("gerade" add var_l);
      var_l -= 1;
   }
   zaehl = 0;
   var_l = zz_min;
   zz_x_alt = 0;
   zz_y_alt = 0;
}
function zz_balken()
{
   _root.pen._alpha = _root.trans;
   _root.pen._x = x0 + zz_x;
   _root.pen._y = y0 + zz_y;
}
function pegel()
{
   _root.pegelMC._alpha = trans;
   _root.pegelMC["p" add pegelcount]._yscale = 100 - random(200);
   pegelcount += 1;
   if(39 < pegelcount)
   {
      pegelcount = 0;
   }
}
function woistdieMaus()
{
   _root.mausi = [_root._xmouse,_root._ymouse];
   fakevar = mausi[0];
   fakevar2 = mausi[1];
   if(mausi[0] >= 44 && 524 >= mausi[0] && mausi[1] >= 93 && 475 >= mausi[1])
   {
      gridflag = true;
   }
   else
   {
      gridflag = false;
   }
}
