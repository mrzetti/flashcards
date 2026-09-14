global gAbfolge, gNextStep

on exitFrame
  if (gAbfolge = EMPTY) or voidp(gAbfolge) then
    set gAbfolge to "1,2,3,4,5"
  end if
  set gNextStep to item 1 of gAbfolge
  delete item 1 of gAbfolge
  checkNextStep()
end

on checkNextStep
  if gNextStep = 1 then
    go("geschichte")
  else
    if gNextStep = 2 then
      go("tafelnA")
    else
      if gNextStep = 3 then
        go("kreuze")
      else
        if gNextStep = 4 then
          go("tafelnB")
        else
          if gNextStep = 5 then
            go("kreuze")
          end if
        end if
      end if
    end if
  end if
end
