@echo off

del /q output\*.*

rem node .\CreateSoilFiles.js .\run_01.lyr /GN run_01 /SN MeadIr_run_01

node .\CreateSoilFiles.js %*

pause

cd %2
pkzip25 data -ext > nul

cd ..\output
for %%i in (*) do (
  rem fc /w %%i ..\%2\%%i > nul || (code %%i test\%%i & pause)
  fc /w %%i ..\%2\%%i > nul || (call c1 %%i ..\%2\%%i & timeout 2)
  cd ..\output
)

cd ..\%2
pkzip25 data -add * -move > nul

cd ..
