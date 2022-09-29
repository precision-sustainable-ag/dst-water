for /d %%i in (run*) do (
  cd %%i
  call grid1.bat
  timeout 1
  pkzip25 data -add * -move
  cd ..
)