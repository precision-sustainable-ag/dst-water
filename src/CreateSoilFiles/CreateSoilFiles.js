// replaces the VBA code of https://github.com/USDA-ARS-ACSL/ExcelInterface/blob/master/ExcelInterface/read%20plant%20filesV7_mulch.xlsm
// replaces the C# and Fortran code of https://github.com/USDA-ARS-ACSL/CreateSoilFiles

const axios = require('axios');
const fs = require('fs');
const XLSX = require('xlsx');
const {readFile, arg, exit, error, dataTable} = require('./utilities');

const wb = XLSX.readFile(process.argv[2]);
const site = process.argv[3];

const unindent = (spaces, s) => {
  const rep = ' '.repeat(s.replace(/^[\n\r]+/, '').match(/^ +/)[0].length);
  return s.replace(RegExp(`^${rep}`, 'mg'), ' '.repeat(spaces + 1)).trim() + '\n';
} // unindent

const ExcelDateToJSDate = (serial) => { // https://stackoverflow.com/a/65472305/3903374
  if (/\//.test(serial)) {
    return serial;
  }    
  // Deal with time zone
  var step = new Date().getTimezoneOffset() <= 0 ? 25567 + 2 : 25567 + 1;
  var utc_days  = Math.floor(serial - step);
  var utc_value = utc_days * 86400;                                        
  var date_info = new Date(utc_value * 1000);

  var fractional_day = serial - Math.floor(serial) + 0.0000001;

  var total_seconds = Math.floor(86400 * fractional_day);

  var seconds = total_seconds % 60;

  total_seconds -= seconds;

  var hours = Math.floor(total_seconds / (60 * 60));
  var minutes = Math.floor(total_seconds / 60) % 60;

  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
} // ExcelDateToJSDate

const dateFormat = (date, padding=2) => {
  const year = date.getFullYear();
  const month = (1 + date.getMonth()).toString().padStart(padding, '0');
  const day = date.getDate().toString().padStart(padding, '0');
  
  return `${month}/${day}/${year}`;
} // dateFormat

const xl = {
  Description:    [],
  Biology:        [],
  Climate:        [],
  Fertilization:  [],
  Tillage:        [],
  GridRatio:      [],
  Irrig:          [],
  Drip:           [],
  DripNodes:      [],
  Init:           [],
  Soil:           [],
  Solute:         [],
  Time:           [],
  Variety:        [],
  Weather:        [],
  Gas:            [],
  MulchDecomp:    [],
  MulchGeo:       [],
};

Object.keys(xl).forEach(key => {
  const data = XLSX.utils.sheet_to_json(wb.Sheets[key]).map(row => {
    Object.keys(row).forEach(key => {
      if (key !== key.toLowerCase()) {
        row[key.toLowerCase()] = row[key];
        delete row[key];
      }
    });
    return row;
  });

  xl[key] = data;
});

const cols = (...data) => {
  return data.map(d => {
    if      (+d >= 0) return (' ' + d.toString()).padEnd(14);
    else if (+d < 0)  return d.toString().padEnd(14);
    else              return `'${d}'`.padEnd(14);
  }).join('');
} // cols

const worksheet = () => {
  let climateID;

  const max = (table, id, col) => {
    return Math.max.apply(Math, dbRecord(table, id).map(d => +d[col]));
  } // max

  const noe = (n, round=16) => (+n).toFixed(round).replace(/0+$/, '').replace(/\.$/, '');

  const dbRecords = (table, id) => {
    const key = table === 'Soil'          ? 'soilfile'  :
                table === 'GridRatio'     ? 'soilfile'  :
                table === 'Climate'       ? 'climateid' :
                table === 'Weather'       ? 'climateid' :
                table === 'Variety'       ? 'hybrid'    :
                                            'id';

    if (!xl[table]) {
      console.error(`dbRecords('${table}')`);
    }

    const recs = xl[table].filter(d => d[key] === id);

    return recs;
  } // dbRecords

  const dbRecord = (table, id) => {
    const key = table === 'Soil'          ? 'soilfile'  :
                table === 'GridRatio'     ? 'soilfile'  :
                table === 'Climate'       ? 'climateid' :
                table === 'Weather'       ? 'climateid' :
                table === 'Variety'       ? 'hybrid'    :
                                            'id';
    const data = xl[table];
    const recs = data.filter(d => (d[key] || '').toLowerCase().trim() === id.toLowerCase().trim());

    if (!recs.length) {
      console.log(data);
      console.error(`Unknown: ${table} ${id}`);
    } else if (recs.length > 1) {
      return recs;
    } else {
      return new Proxy(recs[0], {
        get(target, key) {
          return key in target ? target[key] : target[key.toLowerCase()];
        }
      });
    }
  } // dbRecord

  const output = (fn, s) => {
    const spaces = ' '.repeat(s.match(/ +/)[0].length);
    const re = new RegExp('^' + spaces, 'mg');

    fs.writeFileSync(`output/${fn}`, s.replace(re, '').trim());
  } // output

  const WriteBio = () => {
    const rec = dbRecord('Description', site);
    const biology = rec.Biology;
    const path = `${biology}.bio`;

    return (
      xl.Biology
        .filter(d => d.id === biology)
        .map(d =>
          output(path, `
            *** Example 12.3: Parameters of abiotic responce: file 'SetAbio.dat'
            Dehumification, mineralization, nitrification dependencies on moisture:
             dThH    dThL    es    Th_m
            ${cols(d.dthh, d.dthl, d.es, d.th_m)}
              Dependencies of temperature
             tb     QT
            ${cols(d.tb, d.qt)}
            Denitrification dependencies on water content
            dThD   Th_d
            ${cols(d.dthd, d.th_d)}
          `)
        )
    );
  } // WriteBio

  const WriteIni = () => {
    const descRec = dbRecord('Description', site);
    const initRec = dbRecord('Init', site);
    const depth = max('Soil', descRec.SoilFile, 'bottom depth');

    const path = `${site}.ini`;
 
    const rowSP = initRec.RowSpacing;
    const density = initRec.Population / 10000;
    const popRow = rowSP / 100 * density;
    const date1 = dateFormat(ExcelDateToJSDate(initRec.sowing));
    const date2 = dateFormat(ExcelDateToJSDate(initRec.end));

    return output(path, `
      ***INitialization data for ${site} location
      POPROW  ROWSP  Plant Density      ROWANG  xSeed  ySeed         CEC    EOMult
      ${cols(popRow, +rowSP, density, +initRec.RowAngle, initRec.Xseed, depth - initRec.ySeed, +initRec.CEC, +initRec.EOMult)}
      Latitude longitude altitude
      ${cols(initRec.Lat, initRec.Long, initRec.altitude)}
      AutoIrrigate
       ${initRec.autoirrigated}
        Sowing        end         timestep
      ${cols(date1, date2, 60)}
      output soils data (g03, g04, g05 and g06 files) 1 if true
                                no soil files        output soil files
          0                     1           
    `);
  } // WriteIni

  const WriteSol = () => {
    const descRec = dbRecord('Description', site);
    const solFile = descRec.Solute;
    soilFile = descRec.SoilFile;

    const path = `${solFile}.sol`;

    const soilRecs = dbRecord('Soil', soilFile);

    const solRec = dbRecord('Solute', solFile);

    const textureCl = [];
    
    soilRecs.forEach(rec => {
      const texture = '/loam /clay  /silt';
      const slashes = texture.split('/');
      textureCl.push('clay'); // TODO
    });

    let s = `
      *** SOLUTE MOVER PARAMETER INFORMATION ***
       Number of solutes
       1
       Computational parameters 
       EPSI        lUpW             CourMax
       ${solRec.EPSI}           ${solRec.lUPW}             ${solRec.CourMax}
       Material Information
      Solute#, Ionic/molecular diffusion coefficients of solutes
        1     ${solRec.Diffusion_Coeff}
        Solute#, Layer#, Longitudinal Dispersivity, Transversal Dispersivity (units are cm)\n`;

    // TODO:  See April 20, 2022 5:02 PM email
    const dispersivity = {
      'clay loam'       : 8.1,
      'clay'            : 12.8,
      'loam'            : 4.6,
      'loamy sand'      :	1.6,
      'sand'            : 0.8,
      'sandy clay'      : 10.9,
      'sandy clay loam' : 6,
      'sandy loam'      : 3.4,
      'silt'            : 7,
      'silty clay'      : 11,
      'silty clay loam' : 9.6,
      'silt loam'       : 5.6,
    };
    
    soilRecs.forEach((rec, i) => {
      s += '1             ' + cols(i + 1, 12.8, 12.8 / 2) + '\n';  // TODO: hardcoded for clay
    });

    return output(path, s);
  } // WriteSol

  const WriteMan = () => {
    const descRec = dbRecord('Description', site);
    soilFile = descRec.SoilFile;

    const path = `${site}.man`;

    const maxX = dbRecord('Init', site).RowSpacing / 2;
    
    // strSQL = "select ID, [amount] , depth, C, N, date from [Fertilization$] where ID='" & idStr & "'"
    const fertRecs = dbRecords('Fertilization', site);
    let s = '';
    if (fertRecs.length) {
      s += unindent(0, `
        *** Script for management practices fertilizer, residue and tillage
        [N Fertilizer]
        ****Script for chemical application module  *******mg/cm2= kg/ha* 0.01*rwsp*eomult*100
        Number of Fertilizer applications (max=25) mappl is in total mg N applied to grid (1 kg/ha = 1 mg/m2/width of application) application divided by width of grid in cm is kg ha-1
         ${fertRecs.length}
        mAppl is manure, lAppl is litter. Apply as mg/cm2 of slab same units as N
        tAppl(i)  AmtAppl(i) depth(i) lAppl_C(i) lAppl_N(i)  mAppl_C(i) mAppl_N(i)  (repeat these 3 lines for the number of fertilizer applications)
      `);

      // fert data are in the rs record set
      const factor = 0.01 * maxX / 100;  // m2 of slab

      fertRecs.forEach(rec => {
        // area of slab m2/slab x kg/ha x 1 ha/10000 m2 *1e6 mg/kg = mg/slab
        const amount = +(rec.amount * factor / 10000 * 1000000).toFixed(4);
        const depth = rec.depth;
        const L_C = rec.l_c * factor / 10000 * 1000000;  // litter
        const L_N = rec.l_n * factor / 10000 * 1000000;
        const M_C = rec.m_c * factor / 10000 * 1000000;  // manure
        const M_N = rec.m_n * factor / 10000 * 1000000;
        const date1 = dateFormat(ExcelDateToJSDate(rec.date));
        s += cols(date1, amount, depth, L_C, L_N, M_C, M_N) + '\n';
      });
    } else {
      s += unindent(0, `
        ****Script for chemical application module  *******mg/cm2= kg/ha* 0.01*rwsp*eomult*100
        Number of Fertilizer applications (max=25) mappl is in total mg N applied to grid
        (1 kg/ha = 1 mg/m2/width of application) application divided by
        width of grid in cm is kg ha-1
         0
        No fertilization
      `);
    }

    s += unindent(0, `
      [Residue]
      ****Script for residue/mulch application module
      **** Residue amount can be thickness ('t') or mass ('m')   ***
      application  1 or 0, 1(yes) 0(no)
    `);

    // TODO:  Why iterate above but not here?
    if (fertRecs[0].date_residue || (fertRecs[0]['rate (t/ha or  cm)'] && fertRecs[0]['rate (t/ha or  cm)'] != 0)) {
      const date2 = dateFormat(fertRecs[0]['date_residue']);
      s += unindent(0, `
        1
        tAppl_R (i)    't' or 'm'      Mass (gr/m2) or thickness (cm)    vertical layers
        ---either thickness  or Mass
        ${cols(date2, fertRecs[0]['type(t or m)'], fertRecs[0]['rate (t/ha or  cm)'], fertRecs[0]['vertical layers'])}
      `);
    } else {
      s += '0\n';
    }

    const tillageRec = dbRecord('Tillage', descRec.tillage);
    s += unindent(0, `
      [Tillage]
      1: Tillage , 0: No till
      ${cols(tillageRec['till(1/0)'])}
    `);

    if (tillageRec['till(1/0)'] == 1) {
      const sowDate = ExcelDateToJSDate(dbRecord('Init', site).sowing);
      const tillDate = sowDate;
      tillDate.setDate(sowDate.getDate() - tillageRec.daysbeforeplanting);

      const startDate = ExcelDateToJSDate(dbRecord('Time', site).startdate);

      if (tillDate <= startDate) {
        exit('tillage too close to start date, please rechoose');
      }
      s += unindent(0, `
        till_Date   till_Depth
        ${cols(dateFormat(tillDate, 0), tillageRec.depth)}
      `);
    }

    return output(path, s);
  } // WriteMan

  const WriteLayer = () => {
    const descRec = dbRecord('Description', site);
    const path = `${site}.lyr`;
    layerFile = path;

    soilFile = descRec.SoilFile;

    const gridRec = dbRecord('GridRatio', soilFile);
    
    let s = unindent(0, `
      surface ratio    internal ratio: ratio of the distance between two neighboring nodes
      ${cols(gridRec.SR1, gridRec.IR1, gridRec.SR2, gridRec.IR2)}
      Row Spacing
       ${+dbRecord('Init', site).RowSpacing}
       Planting Depth  X limit for roots
      ${cols(gridRec.PlantingDepth, gridRec.XLimitRoot, gridRec.initRtMass)}
      Surface water Boundary Code  surface and bottom Gas boundary codes
      for the  (water boundary code for bottom layer (for all bottom nodes) 1 constant -2 seepage face,  7 drainage
      ${cols(gridRec.BottomBC, gridRec.GasBCTop, gridRec.GasBCBottom)}
       Bottom depth Init Type  OM (%/100)   no3(ppm)       NH4         hNew       Tmpr     CO2     O2    Sand     Silt    Clay     BD     TH33     TH1500  thr ths tha th  Alfa    n   Ks  Kk  thk
       cm         w/m              Frac      ppm          ppm           cm         0C     ppm   ppm  ----  fraction---     g/cm3    cm3/cm3   cm3/cm3
    `);

    // now add soil properties
    const soilRecs = dbRecords('Soil', soilFile);

    soilRecs.forEach(rec => {
      s += ' ' + cols(rec['bottom depth'], rec['init type'], noe(rec['om (%/100)'], 5), noe(rec['no3 (ppm)'], 5), rec['nh4'], rec['hnew'], rec['tmpr'], rec['co2(ppm)'], rec['o2(ppm)'], rec['sand'] / 100, rec['silt'] / 100, rec['clay'] / 100, rec['bd'], rec['th33'], rec['th1500'], rec['thr'], rec['ths'], rec['tha'], rec['th'], rec['alfa'], rec['n'], rec['ks'], rec['kk'], rec['thk']) + '\n';
    });
    
    return output(path, s);
  } // WriteLayer

  const WriteTime = () => {
    const path = `${site}.tim`;

    const timeRec = dbRecord('Time', site);
    const date1 = dateFormat(ExcelDateToJSDate(timeRec.startDate));
    const date2 = dateFormat(ExcelDateToJSDate(timeRec.EndDate));

    let s = unindent(0, `
      *** SYNCHRONIZER INFORMATION *****************************
      Initial time       dt       dtMin     DMul1    DMul2    tFin
      ${cols(date1, timeRec.dt, noe(timeRec.dtMin), timeRec.DMul1, timeRec.DMul2, date2)}
      Output variables, 1 if true  Daily    Hourly
      ${cols(timeRec.Daily, timeRec.Hourly)}
       Daily       Hourly   Weather data frequency. if daily enter 1   0; if hourly enter 0  1  
      ${cols(timeRec.WeatherDaily, timeRec.WeatherHourly)}
      RunToEnd  - if 1 model continues after crop maturity to end time in time file
      ${cols(timeRec.runtoend)}
    `);
  
    return output(path, s);
  } // WriteTime

  const WriteVar = () => { // TODO: 0.0001059 becomes 0.000106.  May not matter
    const descRec = dbRecord('Description', site);
    const path = descRec.VarietyFile;

    hybridFile = descRec.Hybrid;
    const varietyRec = dbRecord('Variety', descRec.Hybrid);

    return output(path, `
      Corn growth simulation for  ${descRec.Hybrid}   variety 
       Juvenile   Daylength   StayGreen  LA_min  Rmax_LTAR              Rmax_LTIR                Phyllochrons from
       leaves     Sensitive               Leaf tip appearance   Leaf tip initiation       TassellInit
      ${cols(varietyRec.JuvenileLeaves, varietyRec.DaylengthSensitive, varietyRec.StayGreen, varietyRec.LM_min, varietyRec.Rmax_LTAR, varietyRec.Rmax_LTIR, varietyRec.PhyllFrmTassel)}
      [SoilRoot]
      *** WATER UPTAKE PARAMETER INFORMATION **************************
       RRRM       RRRY    RVRL
      ${cols(varietyRec.RRRM, varietyRec.RRRY, varietyRec.RVRL)}
       ALPM    ALPY     RTWL    RtMinWtPerUnitArea
      ${cols(varietyRec.ALPM, varietyRec.ALPY, noe(varietyRec.RTWL), noe(varietyRec.RTMinWTperArea))}
      [RootDiff]
       *** ROOT MOVER PARAMETER INFORMATION ***
      EPSI        lUpW             CourMax
      ${cols(varietyRec.EPSI, varietyRec.lUpW, varietyRec.CourMax)}
      Diffusivity and geotropic velocity
      ${cols(varietyRec.Diffx, varietyRec.Diffz, varietyRec.VelZ)}
      [SoilNitrogen]
      *** NITROGEN ROOT UPTAKE PARAMETER INFORMATION **************************
      ISINK    Rroot
      ${cols(varietyRec.Isink, varietyRec.Rroot)}
      ConstI   Constk     Cmin0 
      ${cols(varietyRec.ConstI_M, varietyRec.ConstK_M, varietyRec.Cmin0_M)}
      ${cols(varietyRec.ConstI_Y, varietyRec.ConstK_Y, varietyRec.Cmin0_Y)}
      [Gas_Exchange Species Parameters] 
      **** for photosynthesis calculations ***
      EaVp    EaVc    Eaj     Hj      Sj     Vpm25   Vcm25    Jm25    Rd25    Ear       g0    g1
      75100   55900   32800   220000  702.6   70      50       325    2       39800   0.017   4.53
      *** Second set of parameters for Photosynthesis ****
      f (spec_correct)     scatt  Kc25    Ko25    Kp25    gbs         gi      gamma1
      0.15                 0.15   650      450    80      0.003       1       0.193
      **** Third set of photosynthesis parameters ****
      Gamma_gsw  sensitivity (sf) Reference_Potential_(phyla, bars) stomaRatio widthFact lfWidth (m)
        10.0        2.3               -1.2                             1.0        0.72   0.050
      **** Secondary parameters for miscelanious equations ****
      internal_CO2_Ratio   SC_param      BLC_param
      0.7                   1.57           1.36
      ***** Q10 parameters for respiration and leaf senescence
      Q10MR            Q10LeafSenescense
      2.0                     2.0
      **** parameters for calculating the rank of the largest leaf and potential length of the leaf based on rank
      leafNumberFactor_a1 leafNumberFactor_b1 leafNumberFactor_a2 leafNumberFactor_b2
      -10.61                   0.25                   -5.99           0.27
      **************Leaf Morphology Factors *************
      LAF        WLRATIO         A_LW
       1.37          0.106           0.75
      *******************Temperature factors for growth *****************************
      T_base                 T_opt            t_ceil  t_opt_GDD
      8.0                   32.1              43.7       34.0
    `);
  } // WriteVar

  const WriteClim = () => {
    const descRec = dbRecord('Description', site);
    const path = descRec.ClimateFile;
    climateID = descRec.ClimateID;
    const climateRec = dbRecord('Climate', climateID);
    let weatherRec = dbRecord('Weather', climateID);
    if (weatherRec.length) {
      weatherRec = weatherRec[0];
    }

    let averageHeader = '';
    let averageData = [];
    if (climateRec.DailyWind === 0) {
      averageHeader += 'wind    ';
      averageData.push('', climateRec.AvgWind);
    }

    if (climateRec.RainIntensity === 0 && weatherRec.Time === 'daily') {
      averageHeader += 'irav    ';
      averageData.push('', climateRec.AvgRainRate);
    }
    if (climateRec.DailyConc === 0) {
      averageHeader += 'ChemConc   ';
      averageData.push('', climateRec.ChemConc);
    }
    if (climateRec.DailyCO2 === 0) {
      averageHeader += '  CO2  ';
      averageData.push('', climateRec.AvgCO2);
    }

    return output(path, `
      ***STANDARD METEOROLOGICAL DATA  Header fle for ${descRec.ClimateID}
      Latitude Longitude
      ${cols(climateRec.Latitude, climateRec.Longitude)}
      ^Daily Bulb T(1) ^ Daily Wind(2) ^RainIntensity(3) ^Daily Conc^(4) ,Furrow(5) ^Rel_humid(6) ^CO2(7)
      ${cols(climateRec.DailyBulb, climateRec.DailyWind, climateRec.RainIntensity, climateRec.DailyConc, climateRec.Furrow, climateRec.RelHumid, climateRec.DailyCO2)}
      Parameters for changing of units: BSOLAR BTEMP ATEMP ERAIN BWIND BIR
       BSOLAR is 1e6/3600 to go from j m-2 h-1 to wm-2
      ${cols(climateRec.Bsolar, climateRec.Btemp, climateRec.Atemp, climateRec.Erain, climateRec.BWind, climateRec.BIR)}
      Average values for the site
      ${averageHeader}

      ${cols(...averageData)}
    `);
  } // WriteClim

  const WriteNit = () => {
    const descRec = dbRecord('Description', site);
    const path = descRec.NitrogenFile;
    const soilRecs = dbRecord('Soil', soilFile);
    const maxX = dbRecord('Init', site).RowSpacing / 2 / 100 * 2;
    
    let s = ' ' + unindent(0, `
      *** SoilNit parameters for: ${site}***
      ROW SPACING (m)
       ${maxX}
                                   Potential rate constants:       Ratios and fractions:
        m      kh     kL       km       kn        kd             fe   fh    r0   rL    rm   fa    nq   cs\n`);

    soilRecs.forEach((rec, i) => {
      s += ' ' + cols(i + 1, noe(rec.kh), noe(rec.kl), noe(rec.km), noe(rec.kn), noe(rec.kd), rec.fe, rec.fh, rec.r0, rec.rl, rec.rm, rec.fa, rec.nq, noe(rec.cs)) + '\n';
    });

    return output(path, s);
  } // WriteNit

  const WriteDrip = () => {
    const descRec = dbRecord('Description', site);
    const path = `${site}.drp`;
    soilFile = descRec.SoilFile;

    const dripRec = dbRecords('Drip', site);

    if (!dripRec.length) {
      return output(path, `
        *****Script for Drip application module  ******* mAppl is cm water per hour to a 45 x 30 cm area
        Number of Drip irrigations(max=25)
         0
        No drip irrigation
      `);
    } else {
      const nodesRec = dbRecords('Dripnodes', site);
      output(path, `
        TODO!!!
        *****Script for Drip application module  ******* mAppl is cm water per hour to a 45 x 30 cm area
        Number of Drip irrigations(max=25)
         ${dripRec.length}
      `);
    }
  } // WriteDrip

  const WriteGas = () => {
    const descRec = dbRecord('Description', site);
    const CO2ID = descRec.Gas_CO2;
    const O2ID = descRec.Gas_O2;
    const path = `${descRec.Gas_File}.gas`;

    const CO2Rec = dbRecord('Gas', CO2ID);
    const O2Rec = dbRecord('Gas', O2ID);
    return output(path, `
      *** Gas Movement Parameters Information ***
       Number of gases
       2
       Computational parameters
       EPSI
       ${CO2Rec.EPSI}
       Reduced tortousity rate change with water content (bTort)
       for entire soil domain 
       ${CO2Rec.bTort}
      Gas diffusion coefficients in air at standard conditions, cm2/day
      Gas # 1 (CO2) Gas # 2 (Oxygen) Gas # 3 (Methane)
      ${cols(CO2Rec['Diffusion_Coeff(cm2/day)'], O2Rec['Diffusion_Coeff(cm2/day)'])}
    `);
  } // WriteGas

  const WriteMulch = () => {
    const descRec = dbRecord('Description', site);
    const idStrMulchDecomp = descRec.MulchDecomp;
    const idStrMulchGeo = descRec.MulchGeo;
    const path = `${idStrMulchGeo}.mul`;

    const mulchRec = dbRecord('MulchGeo', idStrMulchGeo);
    const mulchDecompRec = dbRecord('MulchDecomp', idStrMulchDecomp);
    
    return output(path, `
      *** Mulch Material information ****  based on g, m^3, J and oC
      [Basic_Mulch_Configuration]
      ********The mulch grid configuration********
      Minimal Grid Size for Horizontal Element
       ${mulchRec.Min_Hori_Size}
      ********Simulation Specifications (1=Yes; 0=No)********
      Only_Diffusive_Flux     Neglect_LongWave_Radiation      Include_Mulch_Decomputions
      ${cols(mulchRec.Diffusion_Restriction, mulchRec.LongWaveRadiationCtrl, mulchRec.Decomposition_ctrl)}
      [Mulch_Radiation]
      ********Mulch Radiation Properties********
      DeltaRshort DeltaRlong  Omega   epsilon_mulch   alpha_mulch
      ${cols(mulchRec.DeltaRshort, mulchRec.DeltaRlong, mulchRec.Omega, mulchRec.epsilon_mulch, mulchRec.alpha_mulch)}
      [Numerical_Controls]
      ********Picard Iteration COntrol********
      Max Iteration Step (before time step shrinkage) Tolerence for Convergence (%)
      ${cols(mulchRec['MaxStep in Picard Iteration'], mulchRec['Tolerance_head'])}
      [Mulch_Mass_Properties]
      ********Some Basic Information such as density, porosity and empirical parameters********
      VRho_Mulch g/m3  Pore_Space  Max Held Ponding Depth
      ${cols(mulchRec.rho_mulch, mulchRec.pore_space, mulchRec.MaxPondingDepth)}
      [Mulch_Decomposition]
      ********Overall Factors********
      Contacting_Fraction Feeding_Coef
      ${cols(mulchDecompRec.ContactFraction, mulchDecompRec.alpha_feeding)}
      The Fraction of Three Carbon Formats (Initial Value)
       Carbonhydrate(CARB)    Holo-Cellulose (CEL)   Lignin (LIG)
      ${cols(mulchDecompRec['CARB MASS'], mulchDecompRec['CELL MASS'], mulchDecompRec['LIGN MASS'])}
      The Fraction of N in Three Carbon Formats (Initial Value)
       Carbonhydrate(CARB)    Holo-Cellulose (CEL)   Lignin (LIG)
      ${cols(mulchDecompRec['CARB N MASS'], mulchDecompRec['CELL N MASS'], mulchDecompRec['LIGN N MASS'])}
      The Intrinsic Decomposition Speed of Three Carbon Formats (day^-1)
       Carbonhydrate(CARB)    Holo-Cellulose (CEL)   Lignin (LIG)
      ${cols(mulchDecompRec['CARB Decomp'], mulchDecompRec['CELL Decomp'], mulchDecompRec['LIGN Decomp'])}
    `);
  } // WriteMulch

  const WriteWater_bnd = () => {
    // all of this is hard-coded:
    let path = `water.dat`;

    output(path, `
      *** WATER MOVER PARAMETERINFORMATION ***************************
      MaxIt   TolTh TolH    hCritA       hCritS      DtMx  htab1   htabN EPSI.Heat  EPSI.Solute
         20     0.01  0.05  -1.00000E+005 1.0E+010       0.02 0.001   1000     0.5        0.5
    `);

    path = `WaterBound.dat`;
    output(path, `
      *** WATER MOVER TIME-DEPENDENT BOUNDARY
       Time  Node  VarB
       252.542
        6 0.000000E+000
         7 0.000000E+000
         12 0.000000E+000
         13 0.000000E+000
    `);
  } // WriteWater_bnd

  WriteBio();
  WriteIni();
  WriteSol();
  WriteGas();
  WriteMan();
  WriteMulch();
  WriteLayer();
  WriteTime();
  WriteVar();
  WriteClim();
  WriteNit();
  // WriteRun();  // hopefully not needed
  WriteDrip();
  WriteWater_bnd();
} // worksheet

// ____________________________________________________________________________________________________________________________________
// writes the file with input data for rosetta
const CreateSoilFile = (dtLayer, SoilFileName) => {
  const s = [];
  s.push('  Matnum      sand     silt    clay     bd     om   TH33       TH1500 ');
  let matnum = 1;
  dtLayer.forEach(row => {
    s.push(` ${matnum}\t ${row.Sand.toFixed(3)}\t ${row.Silt.toFixed(3)}\t ${row.Clay.toFixed(3)}\t ${row.BD.toFixed(3)}\t ${row.OM.toFixed(3)}\t ${row.TH33.toFixed(3)}\t  ${row.TH1500.toFixed(3)}\t '${row.InitType}'`);
    matnum++;
  });
  s.push('');

  fs.writeFileSync(`output/${SoilFileName}`, s.join('\n'));
} // CreateSoilFile

// ____________________________________________________________________________________________________________________________________
// Returns a vector of values (Segments)for the increments along a line from the starting point to the Length
// The first column is node, the second is the Y value. 
// This method uses a geometric progression where IntervalRatio is the ratio between two depths
// direction is 1 for up to down and -1 for down to up
// Returns ArrayList Segments
const CaclYNodes = (IntervalRatio, Length, StartPoint, FirstInterval,  Direction) => {
  let CalculatedLength = FirstInterval;  // keeps track of the summed length of the segments to compare with the planned length (Length)
  const Segment = [];
  let dNumberOfNodes = 1 - Length / FirstInterval * (1 - IntervalRatio);
  dNumberOfNodes = Math.log(dNumberOfNodes) / Math.log(IntervalRatio) + 1;
  const NumberOfNodes = Math.round(dNumberOfNodes);

  Segment.push(StartPoint);
  Segment.push(StartPoint - FirstInterval * Direction); // those going down will decrease in value
                                                        // those going up increase; in value
  let aux1 = FirstInterval;
  // start at the 3rd node (i=2)
  for (let i = 2; i < NumberOfNodes; i++) {
    if (Direction === 1) {
      aux1 += FirstInterval * Math.pow(IntervalRatio, i - 1);
      let Distance = StartPoint - aux1;
      CalculatedLength += FirstInterval * Math.pow(IntervalRatio, i - 1);
      const Difference = CalculatedLength - Length;
      // if we overshot or undershot the distance we have to correct the last length
      if (i === NumberOfNodes - 1) {
        if (Math.abs(Difference) > 0) {
          Distance += Difference;
        }
      }

      Segment.push(Distance);   // if you round up on number of nodes. you will go past the length.
                                // This can be calculated as (dNumberOfNodes-NumberOfNodes)
    } else if (Direction === -1) {
      aux1 += FirstInterval * Math.pow(IntervalRatio, i - 1);
      let Distance = StartPoint + aux1;
      CalculatedLength += FirstInterval * Math.pow(IntervalRatio, i - 1);
      const Difference = CalculatedLength - Length;

      if (i === NumberOfNodes - 1) {
        if (Math.abs(Difference) > 0) {
          Distance -= Difference;
        }
      }
      Segment.push(Distance);
    }
  }
  return Segment.map(e => +(e.toFixed(5)));
} // CaclYNodes

// ____________________________________________________________________________________________________________________________________
// Returns a vector of values (Segments)for the increments along a line from the starting point to the Length
// The first column is node, the second is the Y value. 
// This method uses a geometric progression where IntervalRatio is the ratio between two depths
// Calculates the nodes for the X dimension (across row). The only input it RowSpacing
// parameters for interval, etc are hardcoded.
// Returns ArrayList Segments
const CaclXNodes = (RowSpacing) => {
  const FirstInterval = .75;
  const IntervalRatio = 1.4;  // WSun change the values to make the number of nodes in X direction become 7
  const Length = RowSpacing / 2;
  const StartPoint = 0;
  const Segment = [];

  let dNumberOfNodes = 1 - Length / FirstInterval * (1 - IntervalRatio);
  dNumberOfNodes = Math.log(dNumberOfNodes) / Math.log(IntervalRatio) + 1;
  const NumberOfNodes = Math.round(dNumberOfNodes);

  let CalculatedLength = FirstInterval;
  Segment.push(StartPoint, StartPoint + FirstInterval); // x axis increases in value
  let aux1 = FirstInterval;
  // start at the 3rd node (i=2)
  for (let i = 2; i < NumberOfNodes; i++) {
    aux1 += FirstInterval * Math.pow(IntervalRatio, i - 1);
    let Distance = StartPoint + aux1;
    CalculatedLength += FirstInterval * Math.pow(IntervalRatio, i - 1);
    const Difference = Length-CalculatedLength;
    //if we overshot or undershot the distance we have to correct the last length
    if (i === NumberOfNodes-1) {
      if (Difference < 0) {
        Distance += Difference;
      }
      if (Math.abs(Difference) > 0) {
        Distance = Length;
      }
    }

    Segment.push(Distance);   // if you round up on number of nodes. you will go past the length.
                              // This can be calculated as (dNumberOfNodes-NumberOfNodes)
  }
  return Segment;
} // CaclXNodes

// ____________________________________________________________________________________________________________________________________
const createSoilFiles = (layerFile) => {
  const data = readFile(layerFile, true);
  
  const [SurfaceIntervalRatio, FirstSurfaceInterval, InternalIntervalRatio, FirstInternalInterval] = data[1];
  const [RowSpacing] = data[3];
  const [PlantingDepth, xRootExtent, rootweightperslab] = data[5];
  const [BottomBC, GasBCTop, GasBCBottom] = data[8];
  // console.log({SurfaceIntervalRatio, FirstSurfaceInterval, InternalIntervalRatio, FirstInternalInterval, RowSpacing, PlantingDepth, xRootExtent, rootweightperslab, BottomBC, GasBCTop, GasBCBottom});

  const dtLayers = dataTable(data.slice(11), [
    'Depth',
    'InitType',
    'OM',
    'NO3',
    'NH4',
    'hNew',
    'Tmpr',
    'CO2',
    'O2',
    'Sand',
    'Silt',
    'Clay',
    'BD',
    'TH33',
    'TH1500',
    'thr',
    'ths',
    'tha',
    'th',
    'alpha',
    'n',
    'ks',
    'kk',
    'thk',
    // the following columns are not in the input data but are needed for calculations
    'OM_Slope',
    'NO3_Slope',
    'NH4_Slope',
    'hNew_Slope',
    'Tmpr_Slope',
    'CO2_Slope',
    'O2_Slope',
    'Sand_Slope',
    'Silt_Slope',
    'Clay_Slope',
    'BD_Slope',
    'Y',
    'Y_Mid'
  ]);

  const MatNum = dtLayers.length;
  const ProfileDepth = dtLayers[MatNum - 1][0];

  // Now calculate midpoint depths in interior layers for use in interpolation later
  // Also calculate Nitrogen and Carbon concentrations from litter and OM additions
  // don't have litter and manure yet but will have it in the future
  
  dtLayers[0]['Y'] = ProfileDepth - dtLayers[0]['Depth'];
  dtLayers[0]['Y_Mid'] = ProfileDepth;
  dtLayers[MatNum - 1]['Y'] = ProfileDepth - dtLayers[MatNum - 1]['Depth'];
  dtLayers[MatNum - 1]['Y_Mid'] = dtLayers[MatNum - 1]['Y'];

  for (let i = 1; i < MatNum - 1; i++) {
    dtLayers[i]['Y'] = ProfileDepth - dtLayers[i]['Depth'];
    dtLayers[i]['Y_Mid'] = (dtLayers[i - 1]['Y'] - dtLayers[i]['Y']) / 2.0;
    dtLayers[i]['Y_Mid'] = dtLayers[i]['Y_Mid'] + dtLayers[i]['Y'];
  }

  // Now calculate slopes of changes in properties from layer to layer so we can interpolate
  // If we add columns after OM then we have to increase the counter in dtLayers.Rows[i + 1][j - 21]. j-21 should begin
  // I think this should be the total number of columns minus the number of columns before OM
  // with column 2 if we add anything after OM. if you add a column before OM then decrease this number

  for (let i = 0; i < MatNum - 1; i++) {
    // slopes begin after column thk; last two columns are y and y_mid values
    for (let j = dtLayers.columns.indexOf('thk') + 1; j < dtLayers.columns.length - 2; j++) { 
      // calculate slopes needed to interpolate soil properties through the profile
      dtLayers[i][j] = (dtLayers[i + 1][j - 22] - dtLayers[i][j - 22]) / (dtLayers[i + 1]['Y_Mid'] - dtLayers[i]['Y_Mid']);
    }
  }

  // Need a decision point here. 

  // 1-We build a grid file from scratch. For this we need - lower depth, material depths, boundary conditions
  // but BC can be set at first. The descritization of the nodes must be handled first. We create the file data2Gen.dat to send
  // to the grid generator

  // 2-If we use a template for the grid file we need to either parse the existing grid file or use an existing data2Gen file. In this 
  // case we have the grid information, we only need to fill in the material numbers

  const GridFileRoot = site; // arg('/GN') || arg('/GM');

  if (GridFileRoot) {
    // we will create a gridgen file and use it to call the mesh generator 
    // This code will create the input file.
    // Get depth of profile

    const myField = dtLayers[MatNum - 1];

    // Do first layer for testing
    const Layer = dtLayers[0];
    const Layer1 = Layer[0];
    const upper = ProfileDepth;
    let lower = ProfileDepth - Layer1;
    const mid = (upper - lower) / 2.0;

    const MasterSegment = [];
    const Segment1 = CaclYNodes(SurfaceIntervalRatio, mid, upper, FirstSurfaceInterval, 1).slice(0, -1);
    const Segment2 = CaclYNodes(InternalIntervalRatio, mid, lower, FirstInternalInterval, -1).sort((a, b) => b - a).slice(0, -1);
    MasterSegment.push(Segment1, Segment2);

    // need to store segment 1 and 2
    if (MatNum > 1) {
      dtLayers.slice(1).forEach(Layer => {
        const upper = lower;
        lower = ProfileDepth - Layer[0];  // the first item in the layer string is the depth
        const mid = (upper - lower) / 2.0;
        const Segment1 = CaclYNodes(InternalIntervalRatio, mid, upper, FirstInternalInterval, 1).slice(0, -1);
        const Segment2 = CaclYNodes(SurfaceIntervalRatio, mid, lower, FirstInternalInterval, -1).sort((a, b) => b - a).slice(0, -1);
        MasterSegment.push(Segment1, Segment2);
      });
    }

    const xSegment = CaclXNodes(RowSpacing);

    WriteToGridGenFile('dataGen2.dat', MasterSegment, xSegment, BottomBC, GasBCTop, GasBCBottom);
    grid_bnd();

    const dsGrid = ParseGridFile('Grid_bnd');
    let dtNodal = dsGrid[0];
    const dtElem4Grid = dsGrid[1];

    // this selects a subset of the rows from the table where y=max(y)
    // in C#:  myRow = dtNodal.Select("Y=MAX(Y)");
    const maxY = Math.max(...dtNodal.map(e => e.Y));
    let myRow = dtNodal.filter(e => e.Y === maxY);

    let LowerDepth = 0;
    let UpperDepth = 0;

    // now select rows that match the upper and lower depths specified for each material (layer) in the layer file
    dtLayers.forEach((myField, i) => {
      // here we select one line of data (a string). Note that field array is a collection of objects.
      // The of object is not stored.
      // Thus we need to cast the FieldArray member as a string before assigning it to the string variable myField.
      
      // need separate selection criteria for first layer in order to be inclusive of both bottom and top values
      // because of the use of <= or just <.
      if (i === 0) {
        UpperDepth = ProfileDepth;
        LowerDepth = ProfileDepth - myField[0];
      } else if (i > 0) {
        UpperDepth = LowerDepth;
        LowerDepth = ProfileDepth - myField[0];
      }

      // create a selection expression to select rows of the table that have "Y" values within the range of the layering scheme

      let expression;
      if (i === 0) {
        expression = (row) => row.Y >= LowerDepth && row.Y <= UpperDepth;
      } else {
        expression = (row) => row.Y >= LowerDepth && row.Y < UpperDepth;
      }

      // select the rows falling within the ranges of depth for that layer
      const myRow = dtNodal.filter(expression);

      // standard method to loop within a DataTable
      myRow.forEach(Row => Row.MatNum = i + 1);
    });

    dtElem4Grid.forEach(Row => {
      const NodeBL = Row.BL;
      const myRow = dtNodal.filter((row) => row.Node === NodeBL);
      Row.MatNum = myRow[0][3];
    });

    WriteGridFile(dsGrid, `${GridFileRoot}.grd`, 'Grid_bnd', MatNum, BottomBC, GasBCTop, GasBCBottom);

    const dtGrid = dsGrid[0];
    // Now get Nodal Data. Need node numbers from grid table and other information from layer file

    CalculateRoot(dsGrid[0], dtElem4Grid, ProfileDepth, PlantingDepth, xRootExtent, rootweightperslab); // WSun call root density and add a new column in nodal file

    dtNodal = CreateNodalTable(dtGrid);

    // Now add layer information to the nodal table
    // If we have only one layer there is no need to interpolate big error here, this code will never execute!!, Matnum is not likely to be one
    // if (MatNum == 1)
    // select MatNum==1
    
    myRow = dtNodal.filter(row => row.MatNum === 1);

    const PERCENT_C = 0.58;
    const PERCENT_N = 0.05;
    myRow.forEach(row => {
      // calculate Nh and Ch here. Need OM and BD.
      row.NO3 = dtLayers[0].NO3; //initially it is ppm or g NO3 per 1,000,000 grams of soil (ug/g) 
      row.Tmpr = dtLayers[0].Tmpr;
      row.CO2 = dtLayers[0].CO2;
      row.O2 = dtLayers[0].O2;
      row.hNew = dtLayers[0].hNew;
      row.NH4 = dtLayers[0].NH4;
      const TempCalc = dtLayers[0].BD * 1.0e6   // gives ug per cm3
                       * dtLayers[0].OM;        // gives ug OM cm3
      row.Ch = TempCalc * PERCENT_C;            // gives ug organic C per cm3 soil
      row.Nh = TempCalc * PERCENT_N;            // gives ug organic N per cm3 soil
    });

    dtLayers.forEach((row, i) => {
      // we have only two regression equations for two or more intervals. I'm not sure if this will work for one or two layers
      // may have to have dummy layers for that case
      
      let expression;
      if (i === MatNum - 2) {
        // in the last case we need to catch the bottom of the last layer as well.
        // This will be filtered out if Y> is used
        expression = (row) => row.Y <= dtLayers[i].Y_Mid && row.Y >= dtLayers[i + 1].Y_Mid;
      } else {
        expression = (row) => row.Y <= dtLayers[i].Y_Mid && row.Y >  dtLayers[i + 1].Y_Mid;
      }

      const myRow = dtNodal.filter(expression);

      myRow.forEach(row => {
        const dy = row.Y - dtLayers[i].Y_Mid;
        // calculate Nh and Ch here. Need OM and BD.
        row.NO3   = dtLayers[i].NO3   + dtLayers[i].NO3_Slope   * dy;
        row.Tmpr  = dtLayers[i].Tmpr  + dtLayers[i].Tmpr_Slope  * dy;
        row.CO2   = dtLayers[i].CO2   + dtLayers[i].CO2_Slope   * dy;
        row.O2    = dtLayers[i].O2    + dtLayers[i].O2_Slope    * dy;
        row.NH4   = dtLayers[i].NH4   + dtLayers[i].NH4_Slope   * dy;
        const TempCalc = (dtLayers[i].BD + dtLayers[i].BD_Slope * dy) * 1.0e6
                         * (dtLayers[i].OM + dtLayers[i].OM_Slope * dy);
        row.Ch = TempCalc * PERCENT_C;
        row.Nh = TempCalc * PERCENT_N;
      });

      dtLayers.forEach((row, i) => {
        // we use MatNum here to select corresponding rows from each table
        const myRow = dtNodal.filter((row) => row.MatNum === i + 1);
        myRow.forEach(mrow => {
          mrow.hNew = row.hNew;
        });
      });
    });

    // drop MatNum column since it is not part of the Nodal file
    dtNodal.remove('MatNum');
    dtNodal.remove('Y');

    // Now write out the nodal and element data 
    WriteNodalFile(`${GridFileRoot}.nod`, dtNodal, dtLayers);

    const SoilFile = soilFile.replace('.soi', '.dat');  // arg('/SN') ? arg('/SN') + '.dat' : '';
    CreateSoilFile(dtLayers, SoilFile);
    
    console.time('rosetta');
    const soildata = readFile(`output/${SoilFile}`).slice(1);
    
    const rosettaData = soildata.map(row => {
      row = [...row];
      row.splice(0, 1);  // remove Matnum
      row.splice(4, 1);  // remove om
      row.splice(6, 1);  // remove 'w'
      row[0] *= 100;     // sand
      row[1] *= 100;     // silt
      row[2] *= 100;     // clay
      delete row.org;
      return row;
    });

    axios
      .post(`https://www.handbook60.org/api/v1/rosetta/1`, {
        soildata: rosettaData,
      })
      .then(data => {
        let s = '           *** Material information ****                                                                   g/g  \r\n';
        s += '   thr       ths         tha       th      Alfa      n        Ks         Kk       thk       BulkD     OM    Sand    Silt    InitType\r\n';

        data.data.van_genuchten_params.forEach((d, i) => {
          let [theta_r, theta_s, alpha, npar, ksat] = d;

          alpha = 10 ** alpha;
          npar  = 10 ** npar;
          ksat  = 10 ** ksat;

          // eslint-disable-next-line no-unused-vars
          const [Matnum, sand, silt, clay, bd, om, TH33, TH1500, inittype] = soildata[i];

          s += `    ${theta_r.toFixed(3)}    ${theta_s.toFixed(3)}    ${theta_r.toFixed(3)}    ${theta_s.toFixed(3)}    ${alpha.toFixed(5)}    ${npar.toFixed(5)}    ${ksat.toFixed(3)}    ${ksat.toFixed(3)}    ${theta_s.toFixed(3)}    ${bd.toFixed(2)} ${om.toFixed(5)}    ${sand.toFixed(2)}    ${silt.toFixed(2)}   ${inittype}\r\n`;
        });

        fs.writeFileSync(`output/${SoilFile.replace('dat', 'soi')}`, s);
        console.timeEnd('rosetta');
      })
      .catch(error => {
        console.error(error);
      }
    );

  };
} // createSoilFiles

// ____________________________________________________________________________________________________________________________________
const CalculateRoot = (dtNode, dtGrid, ProfileDepth, PlantingDepth, xRootExtent, rootweightperslab) => {
  // parameters for root density calcs
  // dx and dy are diffusion coefficients, d1x,d2x, etc are temporary variables
  const difx = 10;
  const dify = 100;
  const M = 1;
  const time = 2;
  let TotalRTWT = 0;
  const NodeArea = Array(5000).fill(0);
  
  // WSun add nodearea calculations
  // dtNode.Columns.Add(new DataColumn("NodeArea", typeof(double)));
  dtGrid.forEach(Dr => {
    const i = Dr.TL;
    const j = Dr.BL;
    const k = Dr.BR;
    const l = Dr.TR;

    if (k === l) {
      const CJ1 = dtNode[i - 1].X - dtNode[k - 1].X;
      const CK1 = dtNode[j - 1].X - dtNode[i - 1].X;
      const BJ1 = dtNode[k - 1].Y - dtNode[i - 1].Y;
      const BK1 = dtNode[i - 1].Y - dtNode[j - 1].Y;

      const AE1 = (CK1 * BJ1 - CJ1 * BK1) / 2.0;

      NodeArea[i] += AE1 / 3.0;
      NodeArea[j] += AE1 / 3.0;
      NodeArea[k] += AE1 / 3.0;
    } else {
      const CJ1 = dtNode[i - 1].X - dtNode[k - 1].X;
      const CK1 = dtNode[j - 1].X - dtNode[i - 1].X;
      const BJ1 = dtNode[k - 1].Y - dtNode[i - 1].Y;
      const BK1 = dtNode[i - 1].Y - dtNode[j - 1].Y;

      const AE1 = (CK1 * BJ1 - CJ1 * BK1) / 2.0;

      NodeArea[i] += AE1 / 3.0;
      NodeArea[j] += AE1 / 3.0;
      NodeArea[k] += AE1 / 3.0;

      const CJ2 = dtNode[i - 1].X - dtNode[l - 1].X;
      const CK2 = dtNode[k - 1].X - dtNode[i - 1].X;
      const BJ2 = dtNode[l - 1].Y - dtNode[i - 1].Y;
      const BK2 = dtNode[i - 1].Y - dtNode[k - 1].Y;
      
      const AE2 = (CK2 * BJ2 - CJ2 * BK2) / 2.0;

      NodeArea[i] += AE2 / 3.0;
      NodeArea[k] += AE2 / 3.0;
      NodeArea[l] += AE2 / 3.0;
    }
  });

  dtNode.forEach(Dr => {
    const Node = Dr.Node;
    const x = Dr.X;
    const y = ProfileDepth - Dr.Y;
    Dr.RTWT0 = 0;
    Dr.NodeArea = NodeArea[Node];

    if (y <= PlantingDepth * 2.0 && x <= xRootExtent) {
      const root2 = 1.0 / (4 * time) * (x * x / difx + y * y / dify);
        
      const root1 = M / (4.0 * 3.1415 * time * Math.sqrt(difx * dify)); 
                          
      Dr.RTWT0 = root1 * Math.exp(-root2); // need to drop the row at the end?
                                           // RTWT = Dr["RTWT"];
    }
    Dr.RTWT1 = (dtNode[Node - 1].NodeArea) * (dtNode[Node - 1].RTWT0); // WSun RTWT1 represents the multiplication of RTWT0 and node area
    TotalRTWT += Dr.RTWT1;// WSun TotalRTWT represents the sum of RTWT1
  });

  //Find nodes and associated elements. 

  // then find the center of the node to get a distance
  // can get node numbers for elements from dtElement and x,y from dt Node
  // calc roots as per x and y 
  // first find centers of the elements where x< 20 and y< 20, 
  // calculate roots at these xs and ys

  // WSun Calculation the root density (RTWT) which read by SPUDSIM 
  const rootweightperslab1 = (rootweightperslab / TotalRTWT);  // WSun  rootweightperslab1 represents the division of root weight per slab and Total RTWT

  //dtNode.Columns.Add(new DataColumn("RTWT", typeof(double))); // WSun RTWT represents the root density which read by SPUDSIM
  dtNode.forEach(Dr => {
    const Node = Dr.Node;
    Dr.RTWT = (dtNode[Node - 1].RTWT0) * rootweightperslab1;
  });

  return dtNode;
} // CalculateRoot

// ____________________________________________________________________________________________________________________________________
// Writes the grid file by taking items from the original file (template) and copying to the new file.
// The grid data with the new material numbers come from the datatable. 
const WriteGridFile = (dsGrid, NewGridFile, OldGridFile, MatNum, BottomBC, GasBCTop, GasBCBottom) => {
  const OutNode = dsGrid[0];
  const OutElem = dsGrid[1];
  const data = readFile(`output/${OldGridFile}`);
  const s = [];
  
  let i = 0;
  s.push(data[i++].org);
  s.push(data[i++].org);
  data[i][5] = MatNum;
  s.push(`  ${data[i++].join('     ')}  `);
  s.push(data[i++].org);

  OutNode.forEach(row => {
    s.push(`\t${row.join('\t')}`);
    i++;
  });

  s.push(data[i++].org);
  s.push(data[i++].org);

  OutElem.forEach(row => {
    s.push(`\t${row.join('\t')}`);
    i++;
  });

  s.push(...data.slice(i).map(row => row.org));
  fs.writeFileSync(`output/${NewGridFile}`, s.join('\n'));
} // WriteGridFile

// ____________________________________________________________________________________________________________________________________
// Reads the Grid file and extracts the grid.
// Creates a table to hold the grid data and fills it with data from the file.
const ParseGridFile = (GridFile) => {
  const data = readFile(`output/${GridFile}`);
  const [_, node, element] = data[2];

  const dtNode = dataTable(data.slice(4, node + 4), [
    'Node',
    'X',
    'Y',
    'MatNum',
    'NodeArea',
    'RTWT0',    // WSun RTWT0 represents relative number of root density (no relationship with any physical) 
    'RTWT1',    // WSun RTWT1 represents the multiplication of RTWT0 and node area
    'RTWT'      // WSun RTWT represents the root density which read by SPUDSIM
  ]);
 
  const dtElem4Grid = dataTable(data.slice(node + 6, element + node + 6), [
    'Element',
    'TL',
    'BL',
    'BR',
    'TR',
    'MatNum'
  ]);

  return [dtNode, dtElem4Grid];
} // ParseGridFile

// ____________________________________________________________________________________________________________________________________
const WriteNodalFile = (NodalFileName, dtNodal) => {
  const s = [' ***************** NODAL INFORMATION for MAIZSIM *******************************************************'];
  s.push(`\t${dtNodal.columns.join('\t')}`)
  dtNodal.forEach(Row => {
    s.push(
      '\t' + 
      Row.map((col, i) =>
        dtNodal.columns[i] === 'Node' ? `${col}` :
        dtNodal.columns[i] === 'RTWT' ? `${col.toFixed(6)}` :
                                        `${col.toFixed(2)}`
      ).join('\t')
    );
  });
  fs.writeFileSync(`output/${NodalFileName}`, s.join('\n'));
} // WriteNodalFile

// ____________________________________________________________________________________________________________________________________
const CreateNodalTable = (dtGrid) => {
  const dtNodal = dataTable(Array(dtGrid.length), [
    'Node',
    'Nh',
    'Ch',
    'Nm',
    'Nl',
    'Cl',
    'Cm',
    'NH4',
    'NO3',
    'Tmpr',
    'hNew',
    'CO2',
    'O2',
    'RTWT',
    'MatNum',
    'Y'
  ]);

  dtGrid.forEach((row, i) => {
    dtNodal[i].Node = i + 1;
    dtNodal[i].RTWT = row.RTWT;
    dtNodal[i].MatNum = row.MatNum;
    dtNodal[i].Y = row.Y;
  });

  return dtNodal;
} // CreateNodalTable

// ____________________________________________________________________________________________________________________________________
// Writes to the GridGenFile which is used by the fortran program
const WriteToGridGenFile = (GridGenInput, YSegment, xSegment, BottomBC, GasBCTop, GasBCBottom) => {
  const s = ['IJ  E00  n00   NumNP  NumEl NMAt  BC  GasBCTop   GasBCBottom'];
  
  // calculate total number of y nodes
  let YnodeCount = 0;
  YSegment.forEach(Seg => YnodeCount += Seg.length);

  s.push(` ${xSegment.length} 1   1  ${xSegment.length * YnodeCount}   ${(xSegment.length - 1) * (YnodeCount - 1)}  0  ${BottomBC}   ${GasBCTop}   ${GasBCBottom}`);
  s.push('x(j): ');

  s.push(` ${xSegment.join('  ')} `);
  s.push('y(i): 1->(NumNP-n00)/IJ+1');

  YSegment.forEach(Seg => s.push(` ${Seg.join('  ')} `));
  fs.writeFileSync('output/datagen2.dat', s.join('\n'));  
} // WriteToGridGenFile

// ____________________________________________________________________________________________________________________________________
const grid_bnd = () => {
  const format = (parms, formats) => {
    let row = '';
    formats.split(',').map(s => s.trim()).forEach(format => {
      if (/\d+x/i.test(format)) {
        row += ' '.repeat(parseInt(format));
      } else if (/\d*i\d/i.test(format)) {
        if (format[0] === 'i') {
          format = '1' + format;
        }
        const [n, w] = format.match(/\d+/g);

        for (let i = 0; i < n; i++) {
          row += (parms.shift().toString() || '0').padStart(w);
        }
      } else if (/\d*f\d*/i.test(format)) {
        if (format[0] === 'f') {
          format = '1' + format;
        }
        const [n, w, d] = format.match(/\d+/g);
        for (let i = 0; i < n; i++) {
          row += (+(parms.shift() || 0)).toFixed(+d).padStart(+w);
        }
      } else if (format[0] === `'`) {
        row += format.replace(/'/g, '');
      } else {
        console.error('UNKNOWN FORMAT:', format);
        process.exit();
      }
    });

    s.push(row);
  } // format

  const data = readFile('output/datagen2.dat');

  const [IJ, e00, n00, NumNP, NumEl, NMat, BC, GasBCTop, GasBCBot] = data[1];

  const x = data[3]; x.unshift('');

  const Numlin = NumNP / IJ;
  const NumElemR = IJ - 1;

  let y = [''];
  for (let i = 5; y.length < Numlin; i++) {
    y = y.concat(data[i]);
  }

  const MatNum = [...Array(Numlin + 1).fill(1)];

  const NumBP = 2 * IJ;

  const s = [];

  const output = (t) => s.push(t);

  output('***************** GRID GENERATOR INFORMATION **********************************************');
  output('KAT   NumNP    NumEl   NumBP    IJ   NumMat');
  format([NumNP, NumEl, NumBP, IJ, NMat], `2x,'2',3i8,2i7`);
  output('   n           x          y      MatNum');

  const XX = [];
  const YY = [];

  for (let i = 1; i <= Numlin; i++) {
    for (let j = 1; j <= IJ; j++) {
      const n = n00 + (i - 1) * IJ + j - 1;
      const xN = x[j];
      const yN = y[i];
      const MatNum1 = MatNum[i];
      format([n, xN, yN, MatNum1], `i5,2f12.2,i8`);
      XX[n] = xN;
      YY[n] = yN;
    }
  }

  output('***************** ELEMENT INFORMATION ******************************************************');
  output('         e         i         j         k         l     MatNumE');

  for (let i = 1; i <= Numlin - 1; i++) {
    for (let j = 1; j <= NumElemR; j++) {
      const e = e00 + (i - 1) * NumElemR + j - 1;
      const k1 = n00 + (i - 1) * IJ + j - 1;
      const k4 = k1 + 1;
      const k2 = k1 + IJ;
      const k3 = k2 + 1;
      format([e, k1, k2, k3, k4, MatNum[i + 1]], '6I10');
    }
  }

  output('****************Boundary geometry information**************************************')
  output('    n  CodeW  CodeC  CodeH  CodeG  Width');

  for (let k = 1; k <= 2; k++) {
    for (let j = 1; j <= IJ; j++) {
      const k2 = Math.min(IJ, j + 1);
      const k1 = Math.max(1, j - 1);
      const Width = (x[k2] - x[k1]) / 2;

      if (k === 1) {
        format([j, GasBCTop, Width], `i5,' -4    0     -4 ', i5, f10.2`);
      } else {
        format([IJ * (Numlin - 1) + j, BC, GasBCBot, Width], `i5, i5, '   0       1     ', i5,f10.2`);
      }
    }
  }

  const NP_temp = [];
  if (BC === -2) { // TODO: untested
    output('***************************Seepage face information********************************************\nNSeep\n  1\nNSP(1)');
    format([IJ], 'i3');
    for (let i = 1; i <= IJ; i++) {
      NP_temp[i] = IJ * (Numlin - 1) + i;
    }
    output('NP(NSP,1)  NP(NSP,2)  NP(NSP,3) ...... NP(NSP,IJ-1)NP(NSP,IJ)');
    format([NP_temp], '100i8');
  } else {
    output('***************************Seepage face information********************************************\nNSeep\n  0');
  }

  output('***************************Drainage Boundaries******************************************\nNDrain\n0');

  fs.writeFileSync('output/grid_bnd', s.join('\n'));
} // grid_bnd

// ____________________________________________________________________________________________________________________________________

let layerFile;
let soilFile;

worksheet();
createSoilFiles(`output/${layerFile}`);
