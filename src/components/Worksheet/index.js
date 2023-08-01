/* eslint-disable jsx-a11y/tabindex-no-positive */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex */
/* eslint-disable no-console */
/* eslint-disable no-shadow */
/* eslint-disable max-len */
/* eslint-disable no-alert */
/* eslint-disable no-use-before-define */
import React, { useEffect, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Dropzone from 'react-dropzone';

import { get, set } from '../../store/Store';
import createSoilFiles from './createsoilfiles';
import './styles.scss';

import { comp } from './comp';

const comps = {};

comp.split('___________').forEach((s) => {
  s = s.trim().split(/[\n\r]+/);
  comps[s[0].trim().toLowerCase()] = s.slice(1).join('\n').trim();
});

const cols = (...data) => data.map((d) => {
  if (d.toString().length > 14) {
    d = Math.round(d, 8);
  }
  if (+d >= 0) return (` ${d.toString()}`).padEnd(14);
  if (+d < 0) return d.toString().padEnd(14);
  return `'${d}'`.padEnd(14);
}).join(''); // cols

const unindent = (spaces, s) => {
  const rep = ' '.repeat(s.replace(/^[\n\r]+/, '').match(/^ +/)[0].length);
  return `${s.replace(RegExp(`^${rep}`, 'mg'), ' '.repeat(spaces + 1)).trim()}\n`;
}; // unindent

const ExcelDateToJSDate = (serial) => { // https://stackoverflow.com/a/65472305/3903374
  if (/\//.test(serial)) {
    return serial;
  }
  // Deal with time zone
  const step = new Date().getTimezoneOffset() <= 0 ? 25567 + 2 : 25567 + 1;
  const utcDays = Math.floor(serial - step);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);

  const fractionalDay = serial - Math.floor(serial) + 0.0000001;

  let totalSeconds = Math.floor(86400 * fractionalDay);

  const seconds = totalSeconds % 60;

  totalSeconds -= seconds;

  const hours = Math.floor(totalSeconds / (60 * 60));
  const minutes = Math.floor(totalSeconds / 60) % 60;

  return new Date(dateInfo.getFullYear(), dateInfo.getMonth(), dateInfo.getDate(), hours, minutes, seconds);
}; // ExcelDateToJSDate

const dateFormat = (date) => {
  const year = date.getFullYear();

  let month = (1 + date.getMonth()).toString();
  month = month.length > 1 ? month : `0${month}`;

  let day = date.getDate().toString();
  day = day.length > 1 ? day : `0${day}`;

  return `${month}/${day}/${year}`;
}; // dateFormat

const WorksheetData = () => {
  const data = useSelector(get.worksheet);
  const site = useSelector(get.site);

  if (!data.length) {
    return null;
  }

  const cols = Object.keys(data[0]);

  data.forEach((row) => { // first row may be missing data
    Object.keys(row).forEach((col) => {
      if (!cols.includes(col)) {
        cols.push(col);
      }
    });
  });

  return (
    <div className="data" tabIndex={1}>
      <table>
        <thead>
          <tr>
            {cols.map((key) => <th key={key}>{key}</th>)}
          </tr>
        </thead>
        <tbody>
          {
            data.map((row, i) => (
              <tr key={i} className={JSON.stringify(row).includes(site) ? 'selected' : ''}>
                {
                  cols.map((key) => (
                    <td key={key}>
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
}; // WorksheetData

const SoilFiles = () => {
  const getSoilFiles = () => {
    let soilFile;
    let climateID;

    const max = (table, id, col) => Math.max(...dbRecord(table, id).map((d) => +d[col])); // max
    const noe = (n, round = 16) => (+n).toFixed(round).replace(/0+$/, '').replace(/\.$/, '');

    const dbRecords = (table, id) => {
      let key;
      if (table === 'Soil') {
        key = 'soilfile';
      } else if (table === 'GridRatio') {
        key = 'soilfile';
      } else if (table === 'Climate') {
        key = 'climateid';
      } else if (table === 'Weather') {
        key = 'climateid';
      } else if (table === 'Variety') {
        key = 'hybrid';
      } else {
        key = 'id';
      }

      if (!xl[table]) {
        alert(`dbRecords('${table}')`);
      }

      const recs = xl[table].filter((d) => d[key] === id);

      return recs;
    }; // dbRecords

    const dbRecord = (table, id) => {
      let key;
      if (table === 'Soil') {
        key = 'soilfile';
      } else if (table === 'GridRatio') {
        key = 'soilfile';
      } else if (table === 'Climate') {
        key = 'climateid';
      } else if (table === 'Weather') {
        key = 'climateid';
      } else if (table === 'Variety') {
        key = 'hybrid';
      } else {
        key = 'id';
      }
      const data = xl[table];
      if (!data) alert(table);
      const recs = data.filter((d) => (d[key] || '').toLowerCase().trim() === id.toLowerCase().trim());

      if (!recs.length) {
        alert(`Unknown: ${table} ${id}`);
      } else if (recs.length > 1) {
        return recs;
      } else {
        return new Proxy(recs[0], {
          get(target, k) {
            return k in target ? target[k] : target[k.toLowerCase()];
          },
        });
      }
      return null;
    }; // dbRecord

    const output = (path, s) => {
      const spaces = ' '.repeat(s.match(/ +/)[0].length);
      const re = new RegExp(`^${spaces}`, 'mg');

      s = s.replace(re, '').trim();

      files[path] = s;
    }; // output

    const writeBio = () => {
      const rec = dbRecord('Description', site);
      const biology = rec.Biology;
      // const path = `${rec.Path}\\${biology}.bio`;
      const path = 'biologydefault.bio';

      return (
        xl.Biology
          .filter((d) => d.id === biology)
          .map((d) => output(path, `
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
            `))
      );
    }; // writeBio

    const writeIni = () => {
      const descRec = dbRecord('Description', site);
      const initRec = dbRecord('Init', site);
      const depth = max('Soil', descRec.SoilFile, 'bottom depth');

      // const path = `${dbRecord('Description', site).Path}\\${site}.ini`;
      const path = 'run_01.ini';

      const rowSP = initRec['RowSpacing(cm)'];
      const density = initRec['population(p/ha)'] / 10000;
      const popRow = (rowSP / 100) * density;
      const date1 = dateFormat(ExcelDateToJSDate(initRec.sowing));
      const date2 = dateFormat(ExcelDateToJSDate(initRec.end));

      output(path, `
        ***INitialization data for ${site} location
        POPROW  ROWSP  Plant Density      ROWANG  xSeed  ySeed         CEC    EOMult
        ${cols(popRow, +rowSP, density, +initRec.RowAngle, initRec.xseed, depth - initRec.seedDepth, +initRec.CEC, +initRec.EOMult)}
        Latitude longitude altitude
        ${cols(initRec.Lat, initRec.Long, initRec['altitude(m)'])}
        AutoIrrigate
         ${initRec.autoirrigated}
          Sowing        end         timestep
        ${cols(date1, date2, 60)}
        output soils data (g03, g04, g05 and g06 files) 1 if true
                                  no soil files        output soil files
            0                     1           
      `);
    }; // writeIni

    const writeSol = () => {
      const descRec = dbRecord('Description', site);
      const solFile = descRec.Solute;
      soilFile = descRec.SoilFile;

      // const path = `${descRec.Path}\\${solFile}.sol`;
      const path = 'nitrogendefault.sol';

      const soilRecs = dbRecord('Soil', soilFile);

      const solRec = dbRecord('Solute', solFile);

      const textureCl = [];

      soilRecs.forEach(() => {
        // const texture = '/loam /clay  /silt';
        // const slashes = texture.split('/');
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
      // const dispersivity = {
      //   'clay loam'       : 8.1,
      //   'clay'            : 12.8,
      //   'loam'            : 4.6,
      //   'loamy sand'      : 1.6,
      //   'sand'            : 0.8,
      //   'sandy clay'      : 10.9,
      //   'sandy clay loam' : 6,
      //   'sandy loam'      : 3.4,
      //   'silt'            : 7,
      //   'silty clay'      : 11,
      //   'silty clay loam' : 9.6,
      //   'silt loam'       : 5.6,
      // };

      soilRecs.forEach((rec, i) => {
        s += `1             ${cols(i + 1, 12.8, 12.8 / 2)}\n`; // TODO: hardcoded for clay
      });

      output(path, s);
    }; // writeSol

    const writeGas = () => {
      const descRec = dbRecord('Description', site);
      const CO2ID = descRec.Gas_CO2;
      const O2ID = descRec.Gas_O2;
      // const path = `${descRec.Gas_File}.gas`;
      const path = 'gasid.gas';

      const CO2Rec = dbRecord('Gas', CO2ID);
      const O2Rec = dbRecord('Gas', O2ID);
      output(path, `
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
    }; // writeGas

    const writeMan = () => {
      const descRec = dbRecord('Description', site);
      soilFile = descRec.SoilFile;

      // const path = `${site}.man`;
      const path = 'run_01.man';

      const maxX = dbRecord('Init', site)['RowSpacing(cm)'] / 2;

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
        const factor = 0.01 * (maxX / 100); // m2 of slab

        fertRecs.forEach((rec) => {
          // area of slab m2/slab x kg/ha x 1 ha/10000 m2 *1e6 mg/kg = mg/slab
          const amount = +((rec.amount * factor) / (10000 * 1000000)).toFixed(4);
          const { depth } = rec;
          const L_C = (rec['litter_c(kg/ha)'] * factor) / (10000 * 1000000); // litter
          const L_N = (rec.litter_n * factor) / (10000 * 1000000);
          const M_C = (rec.manure_c * factor) / (10000 * 1000000); // manure
          const M_N = (rec.manure_n * factor) / (10000 * 1000000);
          const date1 = dateFormat(ExcelDateToJSDate(rec.date));
          s += `${cols(date1, amount, depth, L_C, L_N, M_C, M_N)}\n`;
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
      if (fertRecs[0].date_residue || (fertRecs[0]['rate (t/ha or  cm)'] && +fertRecs[0]['rate (t/ha or  cm)'] !== 0)) {
        const date2 = dateFormat(fertRecs[0].date_residue);
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

      if (+tillageRec['till(1/0)'] === 1) {
        const sowDate = ExcelDateToJSDate(dbRecord('Init', site).sowing);
        const tillDate = sowDate;
        tillDate.setDate(sowDate.getDate() - tillageRec.daysbeforeplanting);

        const startDate = ExcelDateToJSDate(dbRecord('Time', site).startdate);

        if (tillDate <= startDate) {
          alert('tillage too close to start date, please rechoose');
        }
        s += unindent(0, `
          till_Date   till_Depth
          ${cols(dateFormat(tillDate, 0), tillageRec.depth)}
        `);
      }

      output(path, s);
    }; // writeMan

    const writeMulch = () => {
      const descRec = dbRecord('Description', site);
      const idStrMulchDecomp = descRec.MulchDecomp;
      const idStrMulchGeo = descRec.MulchGeo;
      // const path = `${idStrMulchGeo}.mul`;
      const path = 'mulchgeo1.mul';

      const mulchRec = dbRecord('MulchGeo', idStrMulchGeo);
      const mulchDecompRec = dbRecord('MulchDecomp', idStrMulchDecomp);

      output(path, `
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
        ${cols(mulchRec['MaxStep in Picard Iteration'], mulchRec.Tolerance_head)}
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
    }; // writeMulch

    const writeLayer = () => {
      const descRec = dbRecord('Description', site);
      // const path = `${descRec.Path}\\${site}.lyr`;
      const path = 'run_01.lyr';

      soilFile = descRec.SoilFile;

      const gridRec = dbRecord('GridRatio', soilFile);

      let s = unindent(0, `
        surface ratio    internal ratio: ratio of the distance between two neighboring nodes
        ${cols(gridRec.SR1, gridRec.IR1, gridRec.SR2, gridRec.IR2)}
        Row Spacing
         ${+dbRecord('Init', site)['RowSpacing(cm)']}
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

      soilRecs.forEach((rec) => {
        s += ` ${cols(rec['bottom depth'], rec['init type'], noe(rec['om (%/100)'], 5), noe(rec['no3 (ppm)'], 5), rec.nh4, rec.hnew, rec.tmpr, rec['co2(ppm)'], rec['o2(ppm)'], rec.sand / 100, rec.silt / 100, rec.clay / 100, rec.bd, rec.th33, rec.th1500, rec.thr, rec.ths, rec.tha, rec.th, rec.alfa, rec.n, rec.ks, rec.kk, rec.thk)}\n`;
      });

      output(path, s);
    }; // writeLayer

    const writeTime = () => {
      // const descRec = dbRecord('Description', site);
      // const path = `${descRec.Path}\\${site}.tim`;
      const path = 'run_01.tim';

      const timeRec = dbRecord('Time', site);
      const date1 = dateFormat(ExcelDateToJSDate(timeRec.startDate));
      const date2 = dateFormat(ExcelDateToJSDate(timeRec.EndDate));

      const s = unindent(0, `
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

      output(path, s);
    }; // writeTime

    const writeVar = () => { // TODO: 0.0001059 becomes 0.000106.  May not matter
      const descRec = dbRecord('Description', site);
      // const path = `${descRec.Path}\\${descRec.VarietyFile}`;
      const path = 'pn_33b51.var';

      const varietyRec = dbRecord('Variety', descRec.Hybrid);

      output(path, `
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
    }; // writeVar

    const writeClim = () => {
      const descRec = dbRecord('Description', site);
      // const path = descRec.ClimateFile;
      const path = 'agmip2climate.dat';

      climateID = descRec.ClimateID;
      const climateRec = dbRecord('Climate', climateID);
      let weatherRec = dbRecord('Weather', climateID);
      if (weatherRec.length) {
        // eslint-disable-next-line prefer-destructuring
        weatherRec = weatherRec[0];
      }

      let averageHeader = '';
      const averageData = [];
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

      output(path, `
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
    }; // writeClim

    const writeNit = () => {
      // const descRec = dbRecord('Description', site);
      // const path = descRec.NitrogenFile;
      const path = 'agmip.nit';
      const soilRecs = dbRecord('Soil', soilFile);
      const maxX = dbRecord('Init', site)['RowSpacing(cm)'] / 2 / (100 * 2);

      let s = ` ${unindent(0, `
        *** SoilNit parameters for: ${site}***
        ROW SPACING (m)
         ${maxX}
                                     Potential rate constants:       Ratios and fractions:
          m      kh     kL       km       kn        kd             fe   fh    r0   rL    rm   fa    nq   cs\n`)}`;

      soilRecs.forEach((rec, i) => {
        s += ` ${cols(i + 1, noe(rec.kh), noe(rec.kl), noe(rec.km), noe(rec.kn), noe(rec.kd), rec.fe, rec.fh, rec.r0, rec.rl, rec.rm, rec.fa, rec.nq, noe(rec.cs))}\n`;
      });

      output(path, s);
    }; // writeNit

    //    const writeWater = () => {
    //      // all of this is hard-coded:
    //      const path = `water.dat`;
    //
    //      output(path, `
    //        *** WATER MOVER PARAMETERINFORMATION ***************************
    //        MaxIt   TolTh TolH    hCritA       hCritS      DtMx  htab1   htabN EPSI.Heat  EPSI.Solute
    //          20     0.01  0.05  -1.00000E+005 1.0E+010       0.02 0.001   1000     0.5        0.5
    //      `);
    //    } // writeWater
    //
    //    const writeWaterBound = () => {
    //      // all of this is hard-coded:
    //      const path = `waterbound.dat`;
    //
    //      output(path, `
    //        *** WATER MOVER TIME-DEPENDENT BOUNDARY
    //        Time  Node  VarB
    //        252.542
    //          6 0.000000E+000
    //          7 0.000000E+000
    //          12 0.000000E+000
    //          13 0.000000E+000
    //      `);
    //    } // writeWaterBound

    /*
    const WriteDrip = () => {
      const descRec = dbRecord('Description', site);
      const path = `${descRec.Path}\\${site}.drp`;
      soilFile = descRec.SoilFile;

      const dripRec = dbRecords('Drip', site);

      if (!dripRec.length) {
        output(`writeDrip: ${path}`, `
          *****Script for Drip application module  ******* mAppl is cm water per hour to a 45 x 30 cm area
          Number of Drip irrigations(max=25)
           0
          No drip irrigation
        `);
      } else {
        // const nodesRec = dbRecords('Dripnodes', site);
        output(`<b>writeDrip: ${path}</b>`, `
          TODO!!!
          *****Script for Drip application module  ******* mAppl is cm water per hour to a 45 x 30 cm area
          Number of Drip irrigations(max=25)
           ${dripRec.length}
        `);
      }
    } // WriteDrip
    */

    writeBio();
    writeIni();
    writeSol();
    writeGas();
    writeMan();
    writeMulch();
    writeLayer();
    writeTime();
    writeVar();
    writeClim();
    writeNit();
    // writeWater();
    // writeWaterBound();
    // writeWea();
    createSoilFiles(files);
  }; // getSoilFiles

  const files = {};

  const dispatch = useDispatch();
  const xl = useSelector(get.xl);
  const site = useSelector(get.site);

  getSoilFiles();

  useEffect(() => {
    console.log('ok');
    dispatch(set.soilfiles(files));
  });

  return <SoilFiles2 />;
}; // SoilFiles

const SoilFiles2 = () => {
  const match = (file) => {
    const rep = (s) => {
      if (!s) return s;

      s = s.replace(/'(\d+)\/(\d+)\/(\d+)'/g, (_, m, d, y) => `zzz'${+m}/${+d}/${+y}'`); // dates
      s = s.replace(/\d+\.?\d+/g, (d) => (+d).toFixed(2)); // numbers
      s = s.replace(/[\t ]+/g, ' '); // tabs and spaces
      s = s.replace(/\s*[\n\r]+\s*/g, '\r'); // collapse newlines
      s = s.trim();

      return s;
    };

    const s1 = rep(comps[file]);
    const s2 = rep(files[file]);

    if (s2 && s1 !== s2) {
      console.log('_________________');
      console.log(`%c${file}`, 'text-decoration: underline; font-weight: bold; color: brown;');
      const c = rep(comps[file]).split(/[\n\r]/);
      const f = rep(files[file]).split(/[\n\r]/);

      c.forEach((cc, i) => {
        if (rep(cc) !== rep(f[i])) {
          for (let j = 0; j < cc.length; j++) {
            if (cc[j] !== f[i][j]) {
              console.log(' ', c.slice(j - 10, j + 10), ':', f[i].slice(j - 10, j + 10));
              j += 9;
            }
          }
        }
      });
      // console.log('_________________');
    }

    return rep(s1) === rep(s2);
  }; // match

  const files = useSelector(get.soilfiles);
  const site = useSelector(get.site);

  return (
    <div tabIndex={1}>
      <button
        type="button"
        onClick={() => {
          document.querySelectorAll('details').forEach((obj) => { obj.open = false; });
        }}
      >
        Collapse all
      </button>

      <button
        type="button"
        onClick={() => {
          document.querySelectorAll('details').forEach((obj) => { obj.open = true; });
        }}
      >
        Expand all
      </button>

      <button
        type="button"
        onClick={() => {
          if (Object.keys(files).length) {
            const zip = new JSZip();
            Object.keys(files).forEach((file) => {
              zip.file(file, files[file]);
            });

            zip.generateAsync({ type: 'blob' }).then((content) => {
              saveAs(content, 'output.zip');
            });
          }
        }}
      >
        Download
      </button>

      {Object.keys(files).map((file) => {
        let cname = '';

        if (site === 'run_01') {
          if (comps[file]) {
            if (match(file)) {
              cname = 'match';
            } else {
              cname = 'mismatch';
            }
          } else {
            cname = 'missing';
          }
        }

        return (
          <section key={file} className={cname}>
            <details open>
              <summary>{file}</summary>
              <pre>{files[file]}</pre>
            </details>
          </section>
        );
      })}
    </div>
  );
}; // SoilFiles2

const Worksheet = () => {
  const dispatch = useDispatch();
  const xl = useSelector(get.xl);
  const data = useSelector(get.data);
  const button = useSelector(get.worksheetName);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      dispatch(set.data(''));
      dispatch(set.newData(e.target.result));
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePaste = useCallback((event) => {
    const clipboardData = event.clipboardData || window.clipboardData;
    const { items } = clipboardData;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && /excel|spreadsheetml/.test(item.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          dispatch(set.data(''));
          dispatch(set.newData(e.target.result));
        };
        const file = item.getAsFile();
        reader.readAsArrayBuffer(file);
        event.preventDefault();
        return;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  return (
    <div
      className="Worksheet"
      onDragEnter={() => setDragging(true)}
      onDrop={() => setDragging(false)}
      style={{ height: '100vh' }}
    >
      <p>Drag or paste an Excel file here, then select the site from the upper-right dropdown.</p>
      <Dropzone onDrop={handleDrop}>
        {({ getRootProps, getInputProps }) => (
          <div
            {...getRootProps()}
            style={{
              border: '1px dashed black',
              padding: 20,
              display: dragging ? 'block' : 'none',
              position: 'fixed',
              top: 0,
              left: 0,
              height: '100vh',
              width: '100vw',
              background: '#eee',
              zIndex: 10000,
            }}
          >
            <input {...getInputProps()} />
            Drag and drop an Excel file here
          </div>
        )}
      </Dropzone>
      {
        xl.Description.length > 0 && (
          <div
            role="button"
            tabIndex="0"
            onKeyDown={() => null}
            onClick={(e) => {
              const b = e.target;
              if (b.tagName === 'BUTTON') {
                const text = b.textContent;
                dispatch(set.worksheetName(text));
                if (text !== 'Output') {
                  dispatch(set.worksheet(xl[text]));
                }
              }
            }}
          >
            {
              ['Output', ...Object.keys(xl)].map((key) => (
                <button
                  type="button"
                  key={key}
                  className={key === button ? 'selected' : ''}
                >
                  {key}
                </button>
              ))
            }
          </div>
        )
      }
      {data && (
        button === 'Output' ? <SoilFiles /> : <WorksheetData />
      )}
    </div>
  );
}; // Worksheet

export default Worksheet;
