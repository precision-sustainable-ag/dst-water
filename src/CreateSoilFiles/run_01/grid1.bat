rem D:\MAIZSIM07\CreateSoils\CreateSoilFiles_CO2.exe "D:\MAIZSIM07\AgMipEt2\run_01\run_01.lyr" /GN run_01 /SN MeadIr_run_01
rem del output
rem del element_elm
rem del grid_bnd
rem del datagen2.dat

CreateSoilFiles_CO2.exe run_01.lyr /GN run_01 /SN MeadIr_run_01
Dir  *.*  >dir.txt
