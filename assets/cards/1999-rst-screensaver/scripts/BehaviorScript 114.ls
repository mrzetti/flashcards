on exitFrame
  global gHidden
  if gHidden = 1 then
    go("hidden")
  else
    go("verteiler")
  end if
end
