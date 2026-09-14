on mouseUp
  global gMouseH, gMouseV, gHidden
  set gHidden to EMPTY
  set gMouseH to the mouseH
  set gMouseV to the mouseV
  set the keyDownScript to "halt"
  set the mouseDownScript to "halt"
  cursor(200)
  go("verteiler")
end
