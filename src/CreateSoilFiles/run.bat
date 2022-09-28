@echo off

node .\CreateSoilFiles.js .\run_01.lyr /GN run_01 /SN MeadIr_run_01

pause

for %%i in (*bnd, *bio, *dat, *drp, *gas, *grd, *ini, *lyr, *man, *mul, *nit, *nod, *soi, *sol, *tim, *var) do (
  rem fc /w %%i test\%%i > nul || (code %%i test\%%i & pause)
  fc /w %%i test\%%i > nul || (call c1 %%i test\%%i & timeout 2)
)
