
## Author: Resham Thapa ----
## Date: 01/26/2022
# Contact me if you have any questions in this R script: reshambt1@gmail.com; rthapa@ncsu.edu

## This R script read multiple output files from MAIZSIM into R for subsequent analysis for the PSA Geo-spatial project.

## (I). R PACKAGES--------------------------------------------------------------------------------------------------------------------------------------------
## Load required packages----
require(dplyr, warn.conflicts = FALSE)
require(tidyr)
require(lubridate)
require(future)
require(tictoc)
require(readxl)
require(data.table)
require(openxlsx)
require(tibble)
require(stringr)

## (II). GEO-SPATIAL MODEL OUTPUT PROCESSING FUNCTION--------------------------------------------------------------------------------------------------------------------------------------------

"This following function is generated to automatically import all the files with *`.g01`* and *`.G05`* extensions as well as all *`MassBl.out`* files. 
The *`.g01`* files contains model output related to corn growth parameters (e.g., total dry biomass, grain yield, N_dmd, N_Upt, etc). 
The *`.G05`* files contains model outputs related to water balance (e.g. Seas. actual and potential evaporation and transpiration, rain and infiltration, etc.). 
The *`MassBl.out`* files contains model outputs related to N (e.g. inorganiC, organic, litter, and mulch bare N, mulch bare mass and thickness, and mulch C:N ratio). 

Besides these three output files, the function also imports data from the master excel sheet used to generate model input files for both bare and cover crop scenarios.
Particularly, information related to latitude, longitude, population, and end date for model simulation were imported from the *`Init`* sheet in the respective *`BARE OR bare`* master excel sheet. 
Also, needed is the date bare is added (i.e., cover crop termination date) from the *`Fertilization`* sheet in the *`bare`* master excel sheet.

All model data processing and conversion into standard units is done autoamtically. 
The processed excel sheet generated using this function have all masses (yield, N uptake, or soil N, etc) in 'kg/ha'. 
Whereas, all variables related to water (rain, infiltration, evaporation, transpiration) are in 'mm'. 
Finally, variables related to water and N stress indexes are unitless: a value <1 indicate water limited or N limited stress, whereas a value >1 indicated no stress or excess water or excess N stress."

## STEP 1. Run the following function to process .G01, .G05, and MassBl.out files for Geo-spatial project----
geospatial_processing <- function(FileDir, Init, cc_termination_date, Processed_model_out_filepath, Processed_model_out_filename){
    model_out <- data.frame()
  
  # Process Init file
  Init <- Init %>%
    dplyr::select(ID, lat, long, 'altitude(m)', 'population(p/ha)', end) %>%
      dplyr::mutate(end_date = lubridate::mdy(end),
                    ID_new = str_replace(ID, '_.*_','_'))
  names(Init)[names(Init)=="altitude(m)"] = "altitude"
  names(Init)[names(Init)=="population(p/ha)"] = "population"
  
  # Process cc_termination_date file
  cc_termination_date <- cc_termination_date %>%
    dplyr::select(ID, date_residue) %>%
      distinct() %>%
      dplyr::mutate(ID_new = str_replace(ID, '_.*_','_')) %>%
      dplyr::select(ID_new, date_residue)
  
  # Join Init and cc_termination_date files together by ID_new
  model_input_data <- Init %>%
    dplyr::full_join(cc_termination_date, by = 'ID_new') %>%
    dplyr::mutate(date_residue = lubridate::mdy(date_residue),
                  management = 'cc_termination') %>%
    dplyr::select(ID, lat, long, altitude, population, end_date, date_residue, management)
    
  for(i in FileDir){
    skip_to_next <- FALSE
    G01_Files <- list.files(path = i, pattern = "*.g01", full.names = TRUE, recursive = TRUE)
    G05_Files <- list.files(path = i, pattern = "*.G05", full.names = TRUE, recursive = TRUE)
    MassBl_Files <- list.files(path = i, pattern = "MassBl.out", full.names = TRUE, recursive = TRUE)
    
    AllPlantData_G01 <- data.table::rbindlist(lapply(G01_Files, function(x) {
      out <- data.table::fread(x, header = TRUE) %>%
        dplyr::mutate(Date = lubridate::mdy(date),
                      date_time = lubridate::as_datetime(Date) + time*60*60,
                      crop_stage = Note,
                      N_dmd = N_Dem,
                      N_upt = NUpt,
                      GDD = (pmin(Tair,30) - 10)/24, #per stine site, 10C (50F) base, with 30C (86F) max
                      ID = basename(dirname(x))) %>% # create a new column to indicate each simulations.
        #dplyr::filter(crop_stage != 'none') %>%
        dplyr::arrange(date_time) %>%
        dplyr::mutate_at(vars('crop_stage'), funs(ifelse(row_number() == n() & crop_stage != 'Matured', 'Sim_ended', crop_stage))) %>%
        dplyr::filter(cumsum(crop_stage == 'Matured') <= 1) %>%
        dplyr::mutate(max_LAI = max(LAI),
                      cum_ETdmd = cumsum(ETdmd),
                      cum_ETsply = cumsum(ETsply),
                      GDDSum = cumsum(GDD)) %>% 
        dplyr::group_by(crop_stage) %>%
        slice(1L) %>% # extract the first row for each group, i.e., the first earliest date when corn reached a specific growth stage.
        dplyr::mutate(crop_stage = replace(crop_stage, crop_stage == 'none', 'Sowing')) %>%
        dplyr::arrange(Date) %>%
        dplyr::select(ID, crop_stage, Date, LAI, totalDM, shootDM, earDM, TotLeafDM, DrpLfDM, stemDM, rootDM, N_dmd, N_upt, max_LAI, cum_ETdmd, cum_ETsply, GDDSum)
      return(out)
    })
    )
  
    #Below - for G05, ran into issue with fread incorrectly adding ',' to all variables when I use header=true, or, as I left it, incorrectly adding a new column and messing up the column names
    #Below is a clunky fix but it appears to work
    t_old = c("Date_time","Date","PSoilEvap","ASoilEVap","PET_PEN","PE_T_int","transp","CumRain","infil","FLuxAct","Drainage","N_Leach","Runoff","cover","PSIM","SeasPSoEv","SeasASoEv","SeasPTran","SeasATran","SeasRain","SeasInfil",
              "CO2FLux","ID")
    t_new = c("Date","PSoilEvap","ASoilEVap","PET_PEN","PE_T_int","transp","CumRain","infil","FLuxAct","Drainage","N_Leach","Runoff","cover","PSIM","SeasPSoEv","SeasASoEv","SeasPTran","SeasATran","SeasRain","SeasInfil",
              "CO2FLux","O2FLux","ID")
    AllAtmosData_G05 <- data.table::rbindlist(lapply(G05_Files, function(x) {
      out <- data.table::fread(x, sep = ',') %>%
      dplyr::mutate(ID = basename(dirname(x)))  # create a new column to indicate each simulations.
      return(out)
      })) %>%  # had issues with 'header = TRUE' option adding a comma to all variables, replaced with sep
      select(2:23,25) %>%
      rename_with(~ t_new, all_of(t_old)) %>%
      dplyr::mutate(Date = lubridate::mdy(Date)) %>%
      dplyr::arrange(Date) %>%
      dplyr::mutate(GO5_End = ifelse(row_number() == n(), 'GO5_End', 'NA')) %>%
      dplyr::select(ID, Date, SeasPSoEv, SeasASoEv, SeasPTran, SeasATran, SeasRain, SeasInfil, GO5_End)

    AllMassBlData <- data.table::rbindlist(lapply(MassBl_Files, function(x) {
      out <- data.table::fread(x, sep = ',') %>% # had issues with 'header = TRUE' option adding a comma to all variables?, replaced with sep
        dplyr::mutate(Date = lubridate::mdy(Date),
                      Inorg_N = as.numeric(Min_N) + as.numeric(Ammon_N),
                      Litr_N = as.numeric(Litter_N),
                      Mul_N = as.numeric(Tot_res_N),
                      NO3_lch = as.numeric(CFlux),
                      ID = basename(dirname(x))) %>% # create a new column to indicate each simulations.
        dplyr::arrange(Date) %>%
        dplyr::mutate(MsBl_End = ifelse(row_number() == n(), 'MsBl_End', 'NA')) %>%
        dplyr::select(ID, Date, Inorg_N, Litr_N, Mul_N, NO3_lch,  Mul_Mass, Mul_CNR, MsBl_End)
      return(out)
    })
    )
  
    all_out <- tryCatch(AllPlantData_G01 %>%
                             dplyr::full_join(model_input_data %>% 
                                                dplyr::filter(ID %in% AllPlantData_G01$ID) %>%
                                                  dplyr::select(ID, management, date_residue), 
                                              by = c('ID' = 'ID', 'crop_stage' = 'management', 'Date' = 'date_residue')) %>%
                             dplyr::arrange(Date) %>%
                             dplyr::left_join(AllAtmosData_G05, by = c('ID' = 'ID', 'Date' = 'Date')) %>%
                             dplyr::left_join(AllMassBlData, by = c('ID' = 'ID', 'Date' = 'Date')) %>%
                             dplyr::full_join((AllAtmosData_G05 %>% 
                                                 dplyr::filter(GO5_End == 'GO5_End')), by = c('ID', 'Date', 'SeasPSoEv', 'SeasASoEv', 'SeasPTran', 'SeasATran', 'SeasRain', 'SeasInfil', 'GO5_End')) %>%
                             dplyr::mutate_at(vars('crop_stage'), funs(ifelse(is.na(crop_stage), GO5_End, crop_stage))) %>%
                             tidyr::fill(SeasPSoEv:SeasInfil, .direction = 'updown') %>%
                             dplyr::full_join((AllMassBlData %>% 
                                              dplyr::filter(MsBl_End == 'MsBl_End')), by = c('ID', 'Date', 'Inorg_N', 'Litr_N', 'Mul_N', 'NO3_lch', 'Mul_Mass', 'Mul_CNR', 'MsBl_End')) %>%
                             dplyr::mutate_at(vars('crop_stage'), funs(ifelse(is.na(crop_stage), MsBl_End, crop_stage))) %>%
                             tidyr::fill(Inorg_N:Mul_CNR, .direction = 'updown') %>%
                             distinct(), error = function(e) 
                               #print(paste("Error:", e$message, sep =''))}) ## print error message if there are any; tryCatch functions catches error and skip_to_next will run the loop after skipping errors
                             {skip_to_next <<- TRUE})
    
    if(skip_to_next) {next}
    
    model_out <- rbind(model_out, all_out)
  }
  
  model_out  <- model_out %>%
    tibble::add_row(crop_stage = 'cc_termination', .) %>%
    tibble::add_row(crop_stage = 'Sowing', .) %>%
    tibble::add_row(crop_stage = 'Germinated', .) %>%
    tibble::add_row(crop_stage = 'Emerged', .) %>%
    tibble::add_row(crop_stage = 'Tasselinit', .) %>%
    tibble::add_row(crop_stage = 'Tasseled', .) %>%
    tibble::add_row(crop_stage = 'Silked', .) %>%
    tibble::add_row(crop_stage = 'Matured', .) %>%
    tibble::add_row(crop_stage = 'Sim_ended', .) %>%
    tibble::add_row(crop_stage = 'GO5_End', .) %>%
    tibble::add_row(crop_stage = 'MsBl_End', .)
  
  ## More processing for geo-spatial analysis
  # corn related metrices
   corn_out <- model_input_data %>%
      dplyr::right_join(model_out %>%
            dplyr::filter(crop_stage %in% c('Matured', "Sim_ended")), by = c('ID')) %>%
      dplyr:: mutate(totalDM = round((totalDM * population/1000), 2), # converting from g/plant into kg/ha
                     shootDM = round((shootDM * population/1000),2),
                     earDM = round((earDM * population/1000),2),
                     yield = round((earDM * 86/100),2), # assuming average grain yield is ~86% of the ear weight. 
                     TotLfDM = round((TotLeafDM * population/1000),2),
                     DrpLfDM = round((DrpLfDM * population/1000),2),
                     stemDM = round((stemDM * population/1000),2),
                     rootDM = round((rootDM * population/1000),2),
                     N_upt = round((N_upt * population/1000),2),
                     cum_ETsp =   round((cum_ETsply * population * 1000 * 1/(10000 * 1000 * 1000)),2), #to mm
                     cum_Nlch = round(NO3_lch, 2)) %>%
      dplyr::select(ID, lat, long, max_LAI, yield, LAI, totalDM, shootDM, earDM, TotLfDM, DrpLfDM, stemDM, rootDM, N_upt, cum_Nlch, cum_ETsp, GDDSum) %>%
      dplyr::filter_all(any_vars(!is.na(.)))
    
   # water balance related metrics
   water_out <- model_out %>%
     dplyr::select(ID, crop_stage, Date, SeasPSoEv, SeasASoEv, SeasPTran, SeasATran, SeasRain, SeasInfil) %>%
     tidyr::pivot_wider(names_from = crop_stage, values_from = c(Date, SeasPSoEv, SeasASoEv, SeasPTran, SeasATran, SeasRain, SeasInfil)) %>%
     dplyr::left_join(model_input_data, by = c('ID')) %>%
     dplyr::mutate(dt_cct = Date_cc_termination,
                   dt_Sow = Date_Sowing,
                   dt_Gmn = Date_Germinated,
                   dt_Emg = Date_Emerged,
                   dt_Tsint = Date_Tasselinit,
                   dt_Tsl = Date_Tasseled,
                   dt_Slk = Date_Silked,
                   dt_Gf = Date_grainFill,
                   dt_Mat = Date_Matured,
                   dt_SiEnd = Date_Sim_ended, 
                   GO5_End = as.Date(Date_GO5_End, format = "%m/%d/%Y"),
                   MsBl_End = as.Date(Date_MsBl_End, format = "%m/%d/%Y"),
                   P_Ev_B4P = round(((SeasPSoEv_Sowing - SeasPSoEv_cc_termination)),2), #Units from 2SOIL are now in mm (no longer g plant-1).
                   P_Ev_EVg = round(((SeasPSoEv_Tasselinit - SeasPSoEv_Sowing)),2),
                   P_Ev_LVg = round(((SeasPSoEv_Silked - SeasPSoEv_Tasselinit)),2),
                   P_Ev_Slk = round(((SeasPSoEv_grainFill - SeasPSoEv_Silked)),2),
                   P_Ev_Gf = round(((ifelse(is.na(SeasPSoEv_Matured), SeasPSoEv_Sim_ended, SeasPSoEv_Matured) - SeasPSoEv_grainFill)),2),
                   P_Ev_Veg = round(((SeasPSoEv_Silked - SeasPSoEv_Sowing)),2),
                   P_Ev_Rep = round(((ifelse(is.na(SeasPSoEv_Matured), SeasPSoEv_Sim_ended, SeasPSoEv_Matured) - SeasPSoEv_Silked)),2),
                   P_Ev_cum = round(((ifelse(is.na(SeasPSoEv_Matured), SeasPSoEv_Sim_ended, SeasPSoEv_Matured) - SeasPSoEv_Sowing)),2),
                   A_Ev_B4P = round(((SeasASoEv_Sowing - SeasASoEv_cc_termination)),2),
                   A_Ev_EVg = round(((SeasASoEv_Tasselinit - SeasASoEv_Sowing)),2),
                   A_Ev_LVg = round(((SeasASoEv_Silked - SeasASoEv_Tasselinit)),2),
                   A_Ev_Slk = round(((SeasASoEv_grainFill - SeasASoEv_Silked)),2),
                   A_Ev_Gf = round(((ifelse(is.na(SeasASoEv_Matured), SeasASoEv_Sim_ended, SeasASoEv_Matured) - SeasASoEv_grainFill)),2),
                   A_Ev_Veg = round(((SeasASoEv_Silked - SeasASoEv_Sowing)),2),
                   A_Ev_Rep = round(((ifelse(is.na(SeasASoEv_Matured), SeasASoEv_Sim_ended, SeasASoEv_Matured) - SeasASoEv_Silked)),2),
                   A_Ev_cum = round(((ifelse(is.na(SeasASoEv_Matured), SeasASoEv_Sim_ended, SeasASoEv_Matured) - SeasASoEv_Sowing)),2),
                   P_Tr_B4P = round(((SeasPTran_Sowing - SeasPTran_cc_termination)),2),
                   P_Tr_EVg = round(((SeasPTran_Tasselinit - SeasPTran_Sowing)),2),
                   P_Tr_LVg = round(((SeasPTran_Silked - SeasPTran_Tasselinit)),2),
                   P_Tr_Slk = round(((SeasPTran_grainFill - SeasPTran_Silked)),2),
                   P_Tr_Gf = round(((ifelse(is.na(SeasPTran_Matured), SeasPTran_Sim_ended, SeasPTran_Matured) - SeasPTran_grainFill)),2),
                   P_Tr_Veg = round(((SeasPTran_Silked - SeasPTran_Sowing)),2),
                   P_Tr_Rep = round(((ifelse(is.na(SeasPTran_Matured), SeasPTran_Sim_ended, SeasPTran_Matured) - SeasPTran_Silked)),2),
                   P_Tr_cum = round(((ifelse(is.na(SeasPTran_Matured), SeasPTran_Sim_ended, SeasPTran_Matured) - SeasPTran_Sowing)),2),
                   A_Tr_B4P = round(((SeasATran_Sowing - SeasATran_cc_termination)),2),
                   A_Tr_EVg = round(((SeasATran_Tasselinit - SeasATran_Sowing)),2),
                   A_Tr_LVg = round(((SeasATran_Silked - SeasATran_Tasselinit)),2),
                   A_Tr_Slk = round(((SeasATran_grainFill - SeasATran_Silked)),2),
                   A_Tr_Gf = round(((ifelse(is.na(SeasATran_Matured), SeasATran_Sim_ended, SeasATran_Matured) - SeasATran_grainFill)),2),
                   A_Tr_Veg = round(((SeasATran_Silked - SeasATran_Sowing)),2),
                   A_Tr_Rep = round(((ifelse(is.na(SeasATran_Matured), SeasATran_Sim_ended, SeasATran_Matured) - SeasATran_Silked)),2),
                   A_Tr_cum = round(((ifelse(is.na(SeasATran_Matured), SeasATran_Sim_ended, SeasATran_Matured) - SeasATran_Sowing)),2),
                   Rain_B4P = round(((SeasRain_Sowing - SeasRain_cc_termination)),2),
                   Rain_EVg = round(((SeasRain_Tasselinit - SeasRain_Sowing)),2),
                   Rain_LVg = round(((SeasRain_Silked - SeasRain_Tasselinit)),2),
                   Rain_Slk = round(((SeasRain_grainFill - SeasRain_Silked)),2),
                   Rain_Gf = round(((ifelse(is.na(SeasRain_Matured), SeasRain_Sim_ended, SeasRain_Matured) - SeasRain_grainFill)),2),
                   Rain_Veg = round(((SeasRain_Silked - SeasRain_Sowing)),2),
                   Rain_Rep = round(((ifelse(is.na(SeasRain_Matured), SeasRain_Sim_ended, SeasRain_Matured) - SeasRain_Silked)),2),
                   Rain_cum = round(((ifelse(is.na(SeasRain_Matured), SeasRain_Sim_ended, SeasRain_Matured) - SeasRain_Sowing)),2),
                   Infl_B4P = round(((SeasInfil_Sowing - SeasInfil_cc_termination)),2),
                   Infl_EVg = round(((SeasInfil_Tasselinit - SeasInfil_Sowing)),2),
                   Infl_LVg = round(((SeasInfil_Silked - SeasInfil_Tasselinit)),2),
                   Infl_Slk = round(((SeasInfil_grainFill - SeasInfil_Silked)),2),
                   Infl_Gf = round(((ifelse(is.na(SeasInfil_Matured), SeasInfil_Sim_ended, SeasInfil_Matured) - SeasInfil_grainFill)),2),
                   Infl_Veg = round(((SeasInfil_Silked - SeasInfil_Sowing)),2),
                   Infl_Rep = round(((ifelse(is.na(SeasInfil_Matured), SeasInfil_Sim_ended, SeasInfil_Matured) - SeasInfil_Silked)),2),
                   Infl_cum = round(((ifelse(is.na(SeasInfil_Matured), SeasInfil_Sim_ended, SeasInfil_Matured) - SeasInfil_Sowing)),2)) %>%
     dplyr::select(ID, dt_cct, dt_Sow, dt_Gmn, dt_Emg, dt_Tsint, dt_Tsl, dt_Slk, dt_Gf, dt_Mat, dt_SiEnd, GO5_End, MsBl_End,
                   P_Ev_B4P, P_Ev_EVg, P_Ev_LVg, P_Ev_Slk, P_Ev_Gf, P_Ev_Veg, P_Ev_Rep, P_Ev_cum,
                   A_Ev_B4P, A_Ev_EVg, A_Ev_LVg, A_Ev_Slk, A_Ev_Gf, A_Ev_Veg, A_Ev_Rep, A_Ev_cum,
                   P_Tr_B4P, P_Tr_EVg, P_Tr_LVg, P_Tr_Slk, P_Tr_Gf, P_Tr_Veg, P_Tr_Rep, P_Tr_cum,
                   A_Tr_B4P, A_Tr_EVg, A_Tr_LVg, A_Tr_Slk, A_Tr_Gf, A_Tr_Veg, A_Tr_Rep, A_Tr_cum,
                   Rain_B4P, Rain_EVg, Rain_LVg, Rain_Slk, Rain_Gf, Rain_Veg, Rain_Rep, Rain_cum,
                   Infl_B4P, Infl_EVg, Infl_LVg, Infl_Slk, Infl_Gf, Infl_Veg, Infl_Rep, Infl_cum,) %>%
     dplyr::filter_all(any_vars(!is.na(.)))
    
    
    # water and N stress related metrics
    stress_out <- model_out %>%
      dplyr::left_join(model_input_data, by = c('ID')) %>%
      dplyr::mutate(N_dmd = round((N_dmd * population/1000),2),
                    N_upt = round((N_upt * population/1000),2),
                    cum_ETdmd = round((cum_ETdmd),2),
                    cum_ETsply = round((cum_ETsply),2)) %>%
      dplyr::select(ID, crop_stage,N_dmd, N_upt, cum_ETdmd, cum_ETsply) %>%
      tidyr::pivot_wider(names_from = crop_stage, values_from = c(N_dmd, N_upt, cum_ETdmd, cum_ETsply)) %>%
      dplyr::mutate(
        WSI_EVg = round(((cum_ETsply_Tasselinit - cum_ETsply_Sowing)/(cum_ETdmd_Tasselinit - cum_ETdmd_Sowing)),3),
        WSI_LVg = round(((cum_ETsply_Silked - cum_ETsply_Tasselinit)/(cum_ETdmd_Silked - cum_ETdmd_Tasselinit)),3),
        WSI_Slk = round(((cum_ETsply_grainFill - cum_ETsply_Silked)/(cum_ETdmd_grainFill - cum_ETdmd_Silked)),3),
        WSI_Gf = round(((ifelse(is.na(cum_ETsply_Matured), cum_ETsply_Sim_ended, cum_ETsply_Matured) - cum_ETsply_grainFill)/(ifelse(is.na(cum_ETdmd_Matured), cum_ETdmd_Sim_ended, cum_ETdmd_Matured) - cum_ETdmd_grainFill)),3),
        WSI_Veg = round(((cum_ETsply_Silked - cum_ETsply_Sowing)/(cum_ETdmd_Silked - cum_ETdmd_Sowing)),3),
        WSI_Rep = round(((ifelse(is.na(cum_ETsply_Matured), cum_ETsply_Sim_ended, cum_ETsply_Matured) - cum_ETsply_Silked)/(ifelse(is.na(cum_ETdmd_Matured), cum_ETdmd_Sim_ended, cum_ETdmd_Matured) - cum_ETdmd_Silked)),3),
        WSI_cum = round(((ifelse(is.na(cum_ETsply_Matured), cum_ETsply_Sim_ended, cum_ETsply_Matured) - cum_ETsply_Sowing)/(ifelse(is.na(cum_ETdmd_Matured), cum_ETdmd_Sim_ended, cum_ETdmd_Matured) - cum_ETdmd_Sowing)),3),
        NSI_EVg = round(((N_upt_Tasselinit - N_upt_Sowing)/(N_dmd_Tasselinit - N_dmd_Sowing)),3),
        NSI_LVg = round(((N_upt_Silked - N_upt_Tasselinit)/(N_dmd_Silked - N_dmd_Tasselinit)),3),
        NSI_Slk = round(((N_upt_grainFill - N_upt_Silked)/(N_dmd_grainFill - N_dmd_Silked)),3),
        NSI_Gf = round(((ifelse(is.na(N_upt_Matured), N_upt_Sim_ended, N_upt_Matured) - N_upt_grainFill)/(ifelse(is.na(N_dmd_Matured), N_dmd_Sim_ended, N_dmd_Matured) - N_dmd_grainFill)),3),
        NSI_Veg = round(((N_upt_Silked - N_upt_Sowing)/(N_dmd_Silked - N_dmd_Sowing)),3),
        NSI_Rep = round(((ifelse(is.na(N_upt_Matured), N_upt_Sim_ended, N_upt_Matured) - N_upt_Silked)/(ifelse(is.na(N_dmd_Matured), N_dmd_Sim_ended, N_dmd_Matured) - N_dmd_Silked)),3),
        NSI_cum = round(((ifelse(is.na(N_upt_Matured), N_upt_Sim_ended, N_upt_Matured) - N_upt_Sowing)/(ifelse(is.na(N_dmd_Matured), N_dmd_Sim_ended, N_dmd_Matured) - N_dmd_Sowing)),3)) %>%
      dplyr::select(ID,
                    WSI_EVg, WSI_LVg, WSI_Slk, WSI_Gf, WSI_Veg, WSI_Rep, WSI_cum,
                    NSI_EVg, NSI_LVg, NSI_Slk, NSI_Gf, NSI_Veg, NSI_Rep, NSI_cum) %>%
      dplyr::filter_all(any_vars(!is.na(.)))
    
    # nitrogen related metrics
    nitrogen_out <- model_out %>%
      dplyr::left_join(model_input_data, by = c('ID')) %>%
      dplyr::mutate(N_dmd = round((N_dmd * population/1000),2),
                    N_upt = round((N_upt * population/1000),2)) %>%
      dplyr::select(ID, crop_stage,N_dmd, N_upt, Inorg_N, Litr_N, Mul_N, Mul_Mass, Mul_CNR) %>%
      tidyr::pivot_wider(names_from = crop_stage, values_from = c(N_dmd, N_upt, Inorg_N, Litr_N, Mul_N, Mul_Mass, Mul_CNR)) %>%
      dplyr::mutate(In_N_cct = Inorg_N_cc_termination,
                    In_N_Sow = Inorg_N_Sowing,
                    In_N_LVg = Inorg_N_Tasselinit,
                    In_N_Slk = Inorg_N_Silked,
                    In_N_Res= ifelse(is.na(Inorg_N_Matured), Inorg_N_Sim_ended, Inorg_N_Matured),
                    Lt_N_cct = Litr_N_cc_termination,
                    Lt_N_Sow = Litr_N_Sowing,
                    Lt_N_LVg = Litr_N_Tasselinit,
                    Lt_N_Slk = Litr_N_Silked,
                    Lt_N_Res= ifelse(is.na(Litr_N_Matured), Litr_N_Sim_ended, Litr_N_Matured),
                    ML_N_cct = Mul_N_cc_termination,
                    ML_N_Sow = Mul_N_Sowing,
                    ML_N_LVg = Mul_N_Tasselinit,
                    ML_N_Slk = Mul_N_Silked,
                    ML_N_Res= ifelse(is.na(Mul_N_Matured), Mul_N_Sim_ended, Mul_N_Matured),
                    ML_M_cct = Mul_Mass_cc_termination,
                    ML_M_Sow = Mul_Mass_Sowing,
                    ML_M_LVg = Mul_Mass_Tasselinit,
                    ML_M_Slk = Mul_Mass_Silked,
                    ML_M_Res= ifelse(is.na(Mul_Mass_Matured), Mul_Mass_Sim_ended, Mul_Mass_Matured),
                    MLCN_cct = Mul_CNR_cc_termination,
                    MLCN_Sow = Mul_CNR_Sowing,
                    MLCN_LVg = Mul_CNR_Tasselinit,
                    MLCN_Slk = Mul_CNR_Silked,
                    MLCN_Res= ifelse(is.na(Mul_CNR_Matured), Mul_CNR_Sim_ended, Mul_CNR_Matured)) %>%
      dplyr::select(ID,
                    In_N_cct, In_N_Sow, In_N_LVg, In_N_Slk, In_N_Res,
                    Lt_N_cct, Lt_N_Sow, Lt_N_LVg, Lt_N_Slk, Lt_N_Res,
                    ML_N_cct, ML_N_Sow, ML_N_LVg, ML_N_Slk, ML_N_Res,
                    ML_M_cct, ML_M_Sow, ML_M_LVg, ML_M_Slk, ML_M_Res,
                    MLCN_cct, MLCN_Sow, MLCN_LVg, MLCN_Slk, MLCN_Res) %>%
      dplyr::filter_all(any_vars(!is.na(.)))
    
      # Join corn, water, and nitrogen related metrics into a single table
      combined_model_out <- corn_out %>%
                  dplyr::full_join(water_out, by = c('ID' = 'ID')) %>%
                  dplyr::full_join(nitrogen_out, by = c('ID' = 'ID')) %>%
                  dplyr::full_join(stress_out, by = c('ID' = 'ID')) %>%
                  dplyr::left_join(model_input_data %>% 
                                     dplyr::select(ID, end_date), by = c('ID')) %>%
                  dplyr::mutate(modl_run = ifelse((!is.na(dt_Mat) | difftime(end_date, dt_SiEnd, units = 'days') < 10), 'good', 'bad')) %>%
                  dplyr::select(ID, lat, long, modl_run, yield, N_upt, cum_ETsp, cum_Nlch, GDDSum,
                                Rain_cum, Infl_cum, A_Ev_cum, A_Tr_cum, P_Ev_cum, P_Tr_cum, 
                                WSI_Veg, WSI_Rep, WSI_cum, NSI_Veg, NSI_Rep, NSI_cum, 
                                WSI_EVg, WSI_LVg, WSI_Slk, WSI_Gf, NSI_EVg, NSI_LVg, NSI_Slk, NSI_Gf,
                                LAI, max_LAI, totalDM, shootDM, earDM, TotLfDM, DrpLfDM, stemDM, rootDM,
                                Rain_B4P, Rain_EVg, Rain_LVg, Rain_Slk, Rain_Gf, Rain_Veg, Rain_Rep,
                                Infl_B4P, Infl_EVg, Infl_LVg, Infl_Slk, Infl_Gf, Infl_Veg, Infl_Rep,
                                A_Ev_B4P, A_Ev_EVg, A_Ev_LVg, A_Ev_Slk, A_Ev_Gf, A_Ev_Veg, A_Ev_Rep,
                                A_Tr_B4P, A_Tr_EVg, A_Tr_LVg, A_Tr_Slk, A_Tr_Gf, A_Tr_Veg, A_Tr_Rep,
                                P_Ev_B4P, P_Ev_EVg, P_Ev_LVg, P_Ev_Slk, P_Ev_Gf, P_Ev_Veg, P_Ev_Rep,
                                P_Tr_B4P, P_Tr_EVg, P_Tr_LVg, P_Tr_Slk, P_Tr_Gf, P_Tr_Veg, P_Tr_Rep,
                                In_N_cct, In_N_Sow, In_N_LVg, In_N_Slk, In_N_Res,
                                Lt_N_cct, Lt_N_Sow, Lt_N_LVg, Lt_N_Slk, Lt_N_Res,
                                ML_N_cct, ML_N_Sow, ML_N_LVg, ML_N_Slk, ML_N_Res,
                                ML_M_cct, ML_M_Sow, ML_M_LVg, ML_M_Slk, ML_M_Res,
                                MLCN_cct, MLCN_Sow, MLCN_LVg, MLCN_Slk, MLCN_Res,
                                dt_cct, dt_Sow, dt_Gmn, dt_Emg, dt_Tsint, dt_Tsl, dt_Slk, dt_Gf, dt_Mat, dt_SiEnd, GO5_End, MsBl_End) %>%
                  dplyr::arrange(ID) %>%
                  dplyr::filter_all(any_vars(!is.na(.)))
                     
  # Download the processed (summarized) model output for future graphing in GIS
  openxlsx::write.xlsx(list("final_model_out" = combined_model_out), 
                       file =paste0(Processed_model_out_filepath, Processed_model_out_filename, ".xlsx"))
  
}





##(III). STEPS FOR OUPUT PROCESSING FOR EACH RESPECTIVE COUNTIES--------------------------------------------------------------------------------------------------------------------------------------------
"For you to run this function, which I call 'geospatial_processing' and process model outputs for any given county, follow the following steps.
In this example, I processed model outputs for grid cells from calvert county in MD."

template_mainpath = "D:/PSA_Projects/CROWN_Geospatial/PSA2023_residueinput_templates/"
output_mainpath = "D:/PSA_Projects/CROWN_Geospatial/PSA2023_residueinput_data/"
processed_mainpath = "D:/PSA_Projects/CROWN_Geospatial/PSA2023_residueoutput_data/"

state = "MD"
county = "Frederick_test"
template_path = paste0(template_mainpath,"geospatial_template_",state,"_",county,".xlsx")
output_path = paste0(output_mainpath,state,"/",county)
processed_path = paste0(processed_mainpath)

## STEP 2. Specify the directory path in Ln 346 where master excel used to create model input files is located. ----
"This table will be used later on to convert the model output (i.e., g/plant) into desired units (such as kg/ha or mm of water)."
Init <- read_excel(template_path, sheet = 'Init')

## STEP 3. Specify the directory path in Ln 349 where master excel used to create model input files (residue) is located. ----
"This will be used to extract cover crop termination dates  for data processing purposes."
cc_termination_date <- read_excel(template_path, sheet = 'Fertilization')


## STEP 4. Specify the directory path in Ln 354 where sub-folders containing MAIZSIM outputs from a given county are located.----
"In this example, I specified 'MD_results_calvert', i.e., results for all grid cells from calvert county."
Model_out_Filepath <- output_path
    
FileDir <- list.dirs(path = Model_out_Filepath, full.names = TRUE, recursive = FALSE)

# STEP 5. Specify the directory path in Ln 359 where you want to store the excel sheets that will contain processed model outputs for all grid cells for a given county.----
#For this, make sure to create a folder named 'processed_model_outputs' in your local computer and specify its path in Ln 359.

Processed_model_out_filepath <- processed_path

# STEP 6. Specify the file name in Ln 357,i.e., name of the excel sheet that will contain the processed model outputs.----
"In this example, I specified it as 'MD_bare_results_ann_arundel' BECAUSE it will contain results from grid cells from Ann arundel county for bare simulations."

Processed_model_out_filename <- paste0("PSA2023_residue_",state,"_",county)
    
# STEP 7. Run 'geospatial_processing' function----
tic()
geospatial_processing(FileDir, 
                          Init, 
                          cc_termination_date,
                          Processed_model_out_filepath, 
                          Processed_model_out_filename)
toc()



## STEP 8. Repeat STEP 2-7 for processing model outputs for other MD counties.----

## End of R script for PROCESSING MAIZSIM OUTPUT FILES FOR GEOSPATIAL PROJECTS-----------------------------------------------------------------------------------------------------------------------------------------------------

