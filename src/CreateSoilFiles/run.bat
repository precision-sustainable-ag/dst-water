node .\CreateSoilFiles.js .\run_01.lyr /GN run_01 /SN MeadIr_run_01

pause
call c1 run_01.nod test\run_01.nod
timeout 2
call c1 dataGen2.dat test\dataGen2.dat
timeout 2
call c1 grid_bnd test\grid_bnd
timeout 2
call c1 run_01.grd test\run_01.grd
timeout 2
call c1 Meadir_run_01.dat test\Meadir_run_01.dat 
timeout 2
call c1 Meadir_run_01.soi test\Meadir_run_01.soi