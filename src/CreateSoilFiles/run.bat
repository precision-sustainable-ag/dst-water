node .\CreateSoilFiles.js .\run_01.lyr /GN run_01 /SN MeadIr_run_01
rem exit /b

pause
for %%i in (BiologyDefault.bio run_01.*, Nit*, Pn*, Ag*nit, Ag*dat, data*, grid*, Mead*dat, Mead*soi) do (
  call c1 %%i test\%%i
  timeout 2
)
