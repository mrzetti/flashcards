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
