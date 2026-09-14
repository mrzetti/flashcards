global gTempoH, gTempoV, gRichtungH, gRichtungV, gStartH, gStartV, gMember, gTempMember, gAniArt, gTempH, gTempV, gMouseH, gMouseV, gOne, gTwo, gThree

on startMovie
  set gMouseH to the mouseH
  set gMouseV to the mouseV
  set the keyDownScript to "halt"
  set the mouseDownScript to "halt"
  cursor(200)
end

on stopMovie
  cursor(-1)
end

on enterFrame
  global gHidden
  if gHidden <> 1 then
    if (the mouseH <> gMouseH) or (the mouseV <> gMouseV) then
      halt()
    end if
  end if
end

on halt
  if the frame < 6000 then
    if the optionDown then
      cursor(-1)
      go("hidden")
    else
      go("quit")
    end if
  else
    nothing()
  end if
end

on noHalt
  nothing()
end

on prepareKreuzA
  set gTempMember to random(8)
  if gTempMember = 1 then
    set the member of sprite 1 to member "red_cross"
    doAnimation()
  else
    if gTempMember = 2 then
      set the member of sprite 1 to member "red_cross"
      doAnimation()
    else
      if gTempMember = 3 then
        set the member of sprite 1 to member "red_cross"
        doAnimation()
      else
        if gTempMember = 4 then
          set the member of sprite 1 to member "red_cross"
          doAnimation()
        else
          if gTempMember = 5 then
            set the member of sprite 1 to member "green_cross"
            doAnimation()
          else
            if gTempMember = 6 then
              set the member of sprite 1 to member "green_cross"
              doAnimation()
            else
              if gTempMember = 7 then
                set the member of sprite 1 to member "burning_red"
                doAnimation()
              else
                if gTempMember = 8 then
                  set the member of sprite 1 to member "burning_green"
                  doAnimation()
                end if
              end if
            end if
          end if
        end if
      end if
    end if
  end if
end

on doAnimation
  set gTempoH to random(3) + 1
  set gTempoV to random(3) + 1
  set gRichtungV to "+1"
  set gStartV to -50
  set gStartH to random(800)
  if gStartH < 300 then
    set gRichtungH to "+1"
  else
    if gStartH > 500 then
      set gRichtungH to "-1"
    else
      set gRichtungH to "+1"
    end if
  end if
  puppetSprite(1, 1)
  set the locH of sprite 1 to gStartH
  set the locV of sprite 1 to gStartV
  updateStage()
end

on playAnimationA
  if sprite 1 intersects sprite(5) then
    set the locH of sprite 1 to the locH of sprite 1 + (gRichtungH * gTempoH)
    set the locV of sprite 1 to the locV of sprite 1 + (gRichtungV * gTempoV)
  else
    set gOne to "ready"
  end if
end

on checkAnimation
  if (gOne = "ready") and (gTwo = "ready") then
    set gOne to EMPTY
    set gTwo to EMPTY
    go(the frame + 1)
  end if
end

on ShuffleList aList
  if not listp(aList) then
    exit
  end if
  set listCount to count(aList)
  set workingList to value(string(aList))
  if ilk(aList) = #propList then
    set newShuffledList to shufflePropList(workingList, listCount)
  else
    set newShuffledList to []
    repeat while listCount
      set theIndex to random(listCount)
      add(newShuffledList, getAt(workingList, theIndex))
      deleteAt(workingList, theIndex)
      set listCount to listCount - 1
    end repeat
  end if
  return newShuffledList
end

on resetPuppets
  puppetSprite(1, 0)
  puppetSprite(2, 0)
  updateStage()
end
