global gTempoH2, gTempoV2, gRichtungH2, gRichtungV2, gStartH2, gStartV2, gMember2, gTempMemberB, gTempMember, gAniArt2, gTempH2, gTempV2, gTwo

on prepareKreuzB
  if the member of sprite 1 = member "red_cross" then
    set gTempMemberB to random(3)
    if gTempMemberB = 1 then
      set the member of sprite 2 to member "burning_green"
      doAnimationB()
    else
      if gTempMemberB = 2 then
        set the member of sprite 2 to member "green_cross"
        doAnimationB()
      else
        if gTempMemberB = 3 then
          set the member of sprite 2 to member "leer"
          set gTwo to "ready"
          doAnimationB()
        end if
      end if
    end if
  else
    if the member of sprite 1 = member "green_cross" then
      set gTempMemberB to random(3)
      if gTempMemberB = 1 then
        set the member of sprite 2 to member "red_cross"
        doAnimationB()
      else
        if gTempMemberB = 2 then
          set the member of sprite 2 to member "burning_red"
          doAnimationB()
        else
          if gTempMemberB = 3 then
            set the member of sprite 2 to member "leer"
            set gTwo to "ready"
            doAnimationB()
          end if
        end if
      end if
    else
      if the member of sprite 1 = member "burning_red" then
        set gTempMemberB to random(2)
        if gTempMemberB = 1 then
          set the member of sprite 2 to member "green_cross"
          doAnimationB()
        else
          if gTempMemberB = 2 then
            set the member of sprite 2 to member "burning_green"
            doAnimationB()
          end if
        end if
      else
        if the member of sprite 1 = member "burning_green" then
          set gTempMemberB to random(2)
          if gTempMemberB = 1 then
            set the member of sprite 2 to member "red_cross"
            doAnimationB()
          else
            if gTempMemberB = 2 then
              set the member of sprite 2 to member "burning_red"
              doAnimationB()
            end if
          end if
        end if
      end if
    end if
  end if
end

on doAnimationB
  set gTempoH2 to random(3) + 1
  set gTempoV2 to random(3) + 1
  set gRichtungH2 to "-1"
  set gStartH2 to 825
  set gStartV2 to random(600)
  if gStartV2 < 200 then
    set gRichtungV2 to "+1"
  else
    if gStartV2 > 400 then
      set gRichtungV2 to "-1"
    else
      set gRichtungV2 to "+1"
    end if
  end if
  puppetSprite(2, 1)
  set the locH of sprite 2 to gStartH2
  set the locV of sprite 2 to gStartV2
  updateStage()
end

on playAnimationB
  if sprite 2 intersects sprite(5) then
    set the locH of sprite 2 to the locH of sprite 2 + (gRichtungH2 * gTempoH2)
    set the locV of sprite 2 to the locV of sprite 2 + (gRichtungV2 * gTempoV2)
  else
    set gTwo to "ready"
  end if
end
