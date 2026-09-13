function attachImage(img)
{
   counter++;
   trace(counter + " bitch");
   this.attachMovie("imageClip_" + img,"img_" + img,counter);
}
function deleteImage()
{
   deleter = counter - 1;
}
counter = 0;
attachImage(0);
