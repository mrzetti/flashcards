global gThisMember, gTafelfolge

on exitFrame
  if voidp(gTafelfolge) or (gTafelfolge = EMPTY) or (gTafelfolge = []) then
    set aList to [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
    set gTafelfolge to ShuffleList(aList)
    set gThisMember to getaProp(gTafelfolge, 1)
    deleteProp(gTafelfolge, 1)
  else
    set gThisMember to getaProp(gTafelfolge, 1)
    deleteProp(gTafelfolge, 1)
  end if
  puppetSprite(1, 1)
  set the member of sprite 1 to member gThisMember
  updateStage()
end
