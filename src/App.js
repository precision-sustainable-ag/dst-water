import React from 'react';

import {useSelector, useDispatch} from 'react-redux';

import {get, set} from './store/store';

import {Input} from './components/Inputs';

import './App.css';

import * as XLSX from 'xlsx';

function ExcelDateToJSDate(serial) { // https://stackoverflow.com/a/65472305/3903374
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

const dateFormat = (date) => {
  var year = date.getFullYear();

  var month = (1 + date.getMonth()).toString();
  month = month.length > 1 ? month : '0' + month;

  var day = date.getDate().toString();
  day = day.length > 1 ? day : '0' + day;
  
  return month + '/' + day + '/' + year;
} // dateFormat

const Worksheet = () => {
  const xl = useSelector(get.xl);

  let soilFile;
  let hybridFile;
  let climateID;

  const max = (table, id, col) => {
    return Math.max.apply(Math, dbRecord(table, id).map(d => +d[col]));
  } // max

  const noe = (n, round=16) => (+n).toFixed(round).replace(/0+$/, '').replace(/\.$/, '');

  const dbRecords = (table, id) => {
    const key = table === 'soil'          ? 'soilFile'  :
                table === 'gridratio'     ? 'SoilFile'  :
                table === 'dispersivity'  ? 'texturecl' :
                table === 'climate'       ? 'ClimateID' :
                table === 'weather'       ? 'ClimateID' :
                table === 'variety'       ? 'Hybrid'    :
                                            'ID';

    if (!xl[table]) {
      alert(`dbRecords('${table}')`);
    }

    const recs = xl[table].filter(d => d[key] === id);
    return recs;
  } // dbRecords

  const dbRecord = (table, id) => {
    const key = table === 'Soil'          ? 'soilFile'  :
                table === 'GridRatio'     ? 'SoilFile'  :
                table === 'Dispersivity'  ? 'texturecl' :
                table === 'Climate'       ? 'ClimateID' :
                table === 'Weather'       ? 'ClimateID' :
                table === 'Variety'       ? 'Hybrid'    :
                                            'ID';
    const data = xl[table];
    console.log(data);
    console.log(id);
    const recs = data.filter(d => (d[key] || '').toLowerCase() === id.toLowerCase());

    if (!recs.length) {
      // console.log(data);
      alert(`Unknown: ${table} ${id}`);
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

  const output = (heading, s) => {
    const spaces = ' '.repeat(s.match(/ +/)[0].length);
    const re = new RegExp('^' + spaces, 'mg');

    return (
      <div>
        <p><b>{heading}</b></p>
        {s.replace(re, '').trim()}
        <hr/>
      </div>
    );
  } // output

  const WriteBio = () => {
    const rec = dbRecord('Description', site);
    const biology = rec.Biology;
    const path = `${rec.Path}\\${biology}.bio`;

    return (
      xl.Biology
        .filter(d => d.ID === biology)
        .map(d =>
          output(`writeBio: ${path}`, `
            *** Example 12.3: Parameters of abiotic response: file 'SetAbio.dat'
            Dehumification, mineralization, nitrification dependencies on moisture:
            dThH    dThL    es    Th_m
            ${d.dThH}           ${d.dThL}          ${d.es}           ${d.Th_m}
              Dependencies of temperature
            tb     QT
            ${d.tb}            ${d.QT}
            Denitrification dependencies on water content
            dThD   Th_d
            ${d.dThD}           ${d.Th_d}
          `)
        )
    );
  } // WriteBio

  const WriteIni = () => {
    const descRec = dbRecord('Description', site);
    const initRec = dbRecord('Init', site);
    const depth = max('Soil', descRec.SoilFile, 'Bottom depth');

    const path = `${dbRecord('Description', site).Path}\\${site}.ini`;
 
    const rowSP = initRec.RowSpacing;
    const density = initRec.Population / 10000;
    const popRow = rowSP / 100 * density;
    const date1 = dateFormat(ExcelDateToJSDate(initRec.sowing));
    const date2 = dateFormat(ExcelDateToJSDate(initRec.end));

    return output(`writeIni: ${path}`, `
      ***INitialization data for ${site} location
      POPROW  ROWSP  Plant Density      ROWANG  xSeed  ySeed         CEC    EOMult
       ${popRow}      ${+rowSP}            ${density}        ${+initRec.RowAngle}             ${+initRec.Xseed}             ${depth - initRec.ySeed}           ${+initRec.CEC}          ${+initRec.EOMult}
      Latitude longitude altitude
       ${initRec.Lat}         ${initRec.Long}         ${initRec.altitude}
      AutoIrrigate
       ${initRec.autoirrigated}
        Sowing        end         timestep
      '${date1}'  '${date2}'  60
      output soils data (g03, g04, g05 and g06 files) 1 if true
                                no soil files        output soil files
          0                     1           
    `);
  } // WriteIni

  const WriteSol = () => {
    const descRec = dbRecord('Description', site);
    const solFile = descRec.Solute;
    soilFile = descRec.SoilFile;

    const path = `${descRec.Path}\\${solFile}.sol`;

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
        Solute#, Layer#, Longitudinal Dispersivity, Transversal Dispersivity (units are cm)
    `;

    // TODO: Dispersivity was removed from Excel file:
    /*
    soilRecs.forEach((rec, i) => {
      const dispRec = dbRecord('Dispersivity', textureCl[i]);
      s += `
        1              ${i + 1}             ${dispRec.alpha}          ${dispRec.alpha / 2}
      `;
    });
    */

    return output(`writeSol: ${path}`, s);
  } // WriteSol

  const WriteMan = () => {
    const descRec = dbRecord('Description', site);
    soilFile = descRec.SoilFile;

    const path = `${descRec.Path}\\${site}.man`;

    const maxX = dbRecord('Init', site).RowSpacing / 2;
    
    // strSQL = "select ID, [amount] , depth, C, N, date from [Fertilization$] where ID='" & idStr & "'"
    const fertRecs = dbRecords('Fertilization', site);
    let s = '';
    if (fertRecs.length) {
      s += `
        *** Script for management practices - nitrogen, mulch, water will be added later
        [N Fertilizer]
        ****Script for chemical application module  *******mg/cm2= kg/ha* 0.01*rwsp*eomult*100
        Number of Fertilizer applications (max=25) mappl is in total mg N applied to grid (1 kg/ha = 1 mg/m2/width of application) application divided by width of grid in cm is kg ha-1
         ${fertRecs.length}
        tAppl(i)  AmtAppl(i) depth(i) mAppl_C(i) mAppl_N(i)  (repeat these 3 lines for the number of fertilizer applications)
      `;

      const factor = 0.01 * maxX / 100;  // m2 of slab

      fertRecs.forEach(rec => {
        // area of slab m2/slab x kg/ha x 1 ha/10000 m2 *1e6 mg/kg = mg/slab
        const amount = +(rec.amount * factor / 10000 * 1000000).toFixed(4);
        const depth = rec.depth;
        const sC = rec.C * factor / 10000 * 1000000;
        const sN = rec.N * factor / 10000 * 1000000;
        const date1 = dateFormat(ExcelDateToJSDate(rec.Date), 'mm/dd/yyyy');
        s += `'${date1}'   ${amount}            ${+depth}             ${sC}             ${sN}`;
      });
    } else {
      s += `
        ****Script for chemical application module  *******mg/cm2= kg/ha* 0.01*rwsp*eomult*100
        Number of Fertilizer applications (max=25) mappl is in total mg N applied to grid (1 kg/ha = 1 mg/m2/width of application) application divided by width of grid in cm is kg ha-1
        0
        No fertilization
      `;
    }

    s += `
      [Residue]
      ****Script for residue/mulch application module
      **** Residue amount can be thickness ('t') or mass ('m')   ***
      application  1 or 0, 1(yes) 0(no)
    `;

    // TODO:  Why iterate above but not here?
    if (fertRecs[0].date_residue || (fertRecs[0]['rate (t/ha or  cm)'] && fertRecs[0]['rate (t/ha or  cm)'] != 0)) {
      const date2 = dateFormat(fertRecs[0]['date_residue'], 'mm/dd/yyyy');
      s += `
        1
        tAppl_R (i)    't' or 'm'      Mass (gr/m2) or thickness (cm)    vertical layers
        ---either thickness  or Mass
        '${date2}' '${fertRecs[0]['type(t or m)']}' ${fertRecs[0]['rate (t/ha or  cm)']} ${fertRecs[0]['vertical layers']}
      `;
    } else {
      s += '0';
    }

    return output(`writeMan: ${path}`, s);
  } // WriteMan

  const WriteLayer = () => {
    const descRec = dbRecord('Description', site);
    const path = `${descRec.Path}\\${site}.lyr`;

    soilFile = descRec.SoilFile;

    const gridRec = dbRecord('GridRatio', soilFile);
    
    let s = `
      surface ratio    internal ratio: ratio of the distance between two neighboring nodes
       ${gridRec.SR1}           ${gridRec.IR1}          ${gridRec.SR2}           ${gridRec.IR2}
      Row Spacing
       ${+dbRecord('Init', site).RowSpacing}
       Planting Depth  X limit for roots
       ${gridRec.PlantingDepth}            ${gridRec.XLimitRoot}            ${gridRec.initRtMass}
       Boundary code for bottom layer (for all bottom nodes) 1 constant -2 seepage face
       ${gridRec.BottomBC}
       Bottom depth Init Type  OM (%/100)  no3(ppm)    NH4         hNew   Tmpr    Sand     Silt    Clay     BD     TH33     TH1500  thr ths tha th  Alfa    n   Ks  Kk  thk
    `;

    // now add soil properties
    const soilRecs = dbRecords('Soil', soilFile);
    soilRecs.forEach(rec => {
      s += `
        ${rec['Bottom depth']}           '${rec['Init Type']}'            ${noe(rec['OM (%/100)'], 5)}          ${noe(rec['NO3 (ppm)'], 5)}         ${rec['NH4']}            ${rec['HNew']}           ${rec['Tmpr']}            ${rec['Sand'] / 100}          ${rec['Silt'] / 100}          ${rec['Clay'] / 100}          ${rec['BD']}         ${rec['TH33']}            ${rec['TH1500']}            ${rec['thr']}            ${rec['ths']}            ${rec['tha']}            ${rec['th']}            ${rec['Alfa']}            ${rec['n']}             ${rec['Ks']}          ${rec['Kk']}         ${rec['thk']}
      `;
    });
    
    return output(`writeLayer: ${path}`, s);
    // TODO:  Batch file
  } // WriteLayer

  const WriteTime = () => {
    const descRec = dbRecord('Description', site);
    const path = `${descRec.Path}\\${site}.tim`;

    const timeRec = dbRecord('Time', site);
    const date1 = dateFormat(ExcelDateToJSDate(timeRec.startDate));
    const date2 = dateFormat(ExcelDateToJSDate(timeRec.EndDate));
  
    return output(`writeTime: ${path}`, `
      *** SYNCHRONIZER INFORMATION *****************************
      Initial time       dt       dtMin     DMul1    DMul2    tFin
      '${date1}'   ${timeRec.dt}        ${noe(timeRec.dtMin)}     ${timeRec.DMul1}           ${timeRec.DMul2}          '${date2}'
      Output variables, 1 if true  Daily    Hourly
       ${timeRec.Daily}             ${timeRec.Hourly}
       Daily       Hourly   Weather data frequency. if daily enter 1   0; if hourly enter 0  1  
       ${timeRec.WeatherDaily}             ${timeRec.WeatherHourly}
    `);
  } // WriteTime

  const WriteVar = () => { // TODO: 0.0001059 becomes 0.000106.  May not matter
    const descRec = dbRecord('Description', site);
    const path = `${descRec.Path}\\${descRec.VarietyFile}`;

    hybridFile = descRec.Hybrid;
    const varietyRec = dbRecord('Variety', descRec.Hybrid);

    return output(`writeVar: ${path}`, `
      Corn growth simulation for  ${descRec.Hybrid}   variety 
       Juvenile   Daylength   StayGreen  LA_min  Rmax_LTAR              Rmax_LTIR                Phyllochrons from
       leaves     Sensitive               Leaf tip appearance   Leaf tip initiation       TassellInit
      ${varietyRec.JuvenileLeaves}            ${varietyRec.DaylengthSensitive}             ${varietyRec.StayGreen}           ${varietyRec.LM_min}           ${varietyRec.Rmax_LTAR}          ${varietyRec.Rmax_LTIR}         ${varietyRec.PhyllFrmTassel}
      [SoilRoot]
      *** WATER UPTAKE PARAMETER INFORMATION **************************
       RRRM       RRRY    RVRL
       ${varietyRec.RRRM}         ${varietyRec.RRRY}          ${varietyRec.RVRL}
       ALPM    ALPY     RTWL    RtMinWtPerUnitArea
       ${varietyRec.ALPM}          ${varietyRec.ALPY}          ${noe(varietyRec.RTWL)}     ${noe(varietyRec.RTMinWTperArea)}
      [RootDiff]
       *** ROOT MOVER PARAMETER INFORMATION ***
      EPSI        lUpW             CourMax
       ${varietyRec.EPSI}             ${varietyRec.lUpW}             ${varietyRec.CourMax}
      Diffusivity and geotropic velocity
       ${varietyRec.Diffx}           ${varietyRec.Diffz}           ${varietyRec.VelZ}
      [SoilNitrogen]
      *** NITROGEN ROOT UPTAKE PARAMETER INFORMATION **************************
      ISINK    Rroot         
       ${varietyRec.Isink}             ${varietyRec.Rroot}
      ConstI   Constk     Cmin0 
       ${varietyRec.ConstI_M}            ${varietyRec.ConstK_M}           ${varietyRec.Cmin0_M}
       ${varietyRec.ConstI_Y}          ${varietyRec.ConstK_Y}          ${varietyRec.Cmin0_Y}
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
    const path = `${descRec.Path}\\${descRec.ClimateFile}`;
    climateID = descRec.ClimateID;
    const climateRec = dbRecord('Climate', climateID);
    let weatherRec = dbRecord('Weather', climateID);
    if (weatherRec.length) {
      weatherRec = weatherRec[0];
    }

    let averageHeader = '';
    let averageData = '';
    if (climateRec.DailyWind === 0) {
      averageHeader += 'wind    ';
      averageData   += climateRec.AvgWind;
    }

    if (climateRec.RainIntensity == 0 && weatherRec.Time == 'daily') {
      averageHeader += 'irav    ';
      averageData   += `        ${climateRec.AvgRainRate}`;
    }
    if (climateRec.DailyConc == 0) {
      averageHeader += 'ChemConc    ';
      averageData   += `        ${climateRec.ChemCOnc}`;
    }
    if (climateRec.DailyCO2 == 0) {
      averageHeader += '  CO2  ';
      averageData   += `        ${climateRec.AvgCO2}`;
    }

    return output(`writeClim: ${path}`, `
      ***STANDARD METEOROLOGICAL DATA  Header fle for ${descRec.ClimateID}
      Latitude Longitude
       ${climateRec.Latitude}        ${climateRec.Longitude}
      ^Daily Bulb T(1) ^ Daily Wind(2) ^RainIntensity(3) ^Daily Conc^(4) ,Furrow(5) ^Rel_humid(6) ^CO2(7)
       ${climateRec.DailyBulb}             ${climateRec.DailyWind}             ${climateRec.RainIntensity}             ${climateRec.DailyConc}             ${climateRec.Furrow}             ${climateRec.RelHumid}             ${climateRec.DailyCO2}
      Parameters for changing of units: BSOLAR BTEMP ATEMP ERAIN BWIND BIR
       BSOLAR is 1e6/3600 to go from j m-2 h-1 to wm-2
       ${+climateRec.Bsolar}       ${climateRec.Btemp}             ${climateRec.Atemp}             ${climateRec.Erain}           ${climateRec.BWind}             ${climateRec.BIR}
      Average values for the site
      ${averageHeader}
      ${averageData}
    `);
  } // WriteClim

  const WriteNit = () => {
    const descRec = dbRecord('Description', site);
    const path = `${descRec.Path}\\${descRec.NitrogenFile}`;
    const soilRecs = dbRecord('Soil', soilFile);
    const maxX = dbRecord('Init', site).RowSpacing / 2 / 100 * 2;
    
    let s = `
       *** SoilNit parameters for: ${site}***
      ROW SPACING (m)
      ${maxX}
                                   Potential rate constants:       Ratios and fractions:
        m      kh     kL       km       kn        kd             fe   fh    r0   rL    rm   fa    nq   cs
    `;

    soilRecs.forEach((rec, i) => {
      s += `${i + 1}             ${noe(rec.kh)}       ${noe(rec.kL)}         ${noe(rec.km)}          ${noe(rec.kn)}           ${noe(rec.kd)}     ${rec.fe}           ${rec.fh}           ${rec.r0}            ${rec.rL}            ${rec.rm}            ${rec.fa}           ${rec.nq}             ${noe(rec.cs)}\n`;
    });

    return output(`writeNit: ${path}`, s);
  } // WriteNit

  const WriteDrip = () => {
    const descRec = dbRecord('Description', site);
    const path = `${descRec.Path}\\${site}.drp`;
    soilFile = descRec.SoilFile;

    const dripRec = dbRecords('Drip', site);

    if (!dripRec.length) {
      return output(`writeDrip: ${path}`, `
        *****Script for Drip application module  ******* mAppl is cm water per hour to a 45 x 30 cm area
        Number of Drip irrigations(max=25)
         0
        No drip irrigation
      `);
    } else {
      const nodesRec = dbRecords('Dripnodes', site);
      output(`<b>writeDrip: ${path}</b>`, `
        TODO!!!
        *****Script for Drip application module  ******* mAppl is cm water per hour to a 45 x 30 cm area
        Number of Drip irrigations(max=25)
         ${dripRec.length}
      `);
    }
  } // WriteDrip

  const data = useSelector(get.worksheet);
  console.log(data);
  const site = useSelector(get.site);
  console.log(site);
  const button = useSelector(get.worksheetName);

  if (button === 'Output') {
    return (
      <pre style={{padding: 10}}>
        <WriteBio />
        <WriteIni />
        <WriteSol />
        <WriteMan />
        <WriteLayer />
        <WriteTime />
        <WriteVar />
        <WriteClim />
        <WriteNit />
        <WriteDrip />
      </pre>
    )
  } else {
    if (!data.length) return null;

    const cols = Object.keys(data[0]);
    
    data.forEach(row => {  // first row may be missing data
      Object.keys(row).forEach(col => {
        if (!cols.includes(col)) {
          cols.push(col);
        }
      });
    });

    return (
      <div id="Worksheet">
        <table>
          <thead>
            <tr>
              {cols.map(key => <th>{key}</th>)}
            </tr>
          </thead>
          <tbody>
            {
              data.map(row => (
                <tr className={JSON.stringify(row).includes(site) ? 'selected' : ''}>
                  {
                    cols.map(key => (
                      <td>
                        {
                          Number.isFinite(row[key]) ? +(+row[key]).toFixed(5) : row[key]
                        }
                      </td>
                    ))
                  }
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    );
  }
} // Worksheet

const App = () => {
  console.log('Render: App');

  const dispatch = useDispatch();

  const readXL = (e) => {
    const [file] = e.target.files;
    const reader = new FileReader();

    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      // console.log(wb.SheetNames);

      Object.keys(xl).forEach(key => {
        dispatch(set.xl[key](XLSX.utils.sheet_to_json(wb.Sheets[key])));
      });
      
      dispatch(set.site(wb.Sheets.Description.A2.v));
    };
    reader.readAsBinaryString(file);
  } // readXL

  const xl = useSelector(get.xl);
  const worksheetName = useSelector(get.worksheetName);
  console.log(xl);
  return (
    <>
      <input type="file" onChange={readXL} />
  
      <nav
        onClick={(e) => {
          const button = e.target;
          if (button.tagName === 'BUTTON') {
            const text = button.textContent;
            dispatch(set.worksheetName(text));
            if (text !== 'Output') {
              dispatch(set.worksheet(xl[text]));
            }
          }
        }}
      >
        <select id="Site"
          onChange={(e) => dispatch(set.site(e.target.value))}
        >
          {xl.Description.map(data => <option>{data.ID}</option>).sort()}
        </select>
        
        <button>Output</button>
        
        {
          Object.keys(xl).map(key => (
            <button key={key} className={key === worksheetName ? 'selected' : ''}>
              {key}
            </button>
          ))
        }
      </nav>
      
      <Worksheet />
    </>
  );
}

export default App;
