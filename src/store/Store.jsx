/* eslint-disable no-console */
// // code breaking eslint rules were disabled --- MILAD
/* eslint-disable no-alert */
/* eslint-disable camelcase */
/* eslint-disable max-len */
/* eslint-disable no-use-before-define */

import React from 'react';
// eslint-disable-next-line no-unused-vars
import { current } from '@reduxjs/toolkit';
import { createStore, set } from './redux-autosetters';

const initialState = {
  map: {
    lat: 0,
    lon: 0,
    elevation: 0,
    zoom: 13,
    area: 0,
    bounds: 'conus',
    address: {
      address: '',
      fullAddress: '',
      city: '',
      county: '',
      state: '',
      stateCode: '',
      zipCode: '',
    },
    features: [],
  },
  start: 0,
  newData: '',
  focus: '',
  name: '',
  email: '',
  feedback: '',
  screen: '',
  field: '',
  file: '',
  lat: 40.7849,
  lon: -74.8073,
  model: {},
  SSURGO: {},
  gotSSURGO: false,
  unit: 'lb/ac',
  location: '',
  privacy: false,
  site: '',
  sites: [],
  button: '',
  worksheet: [],
  data: '',
  xl: {
    Description: [],
    Biology: [],
    Climate: [],
    Fertilization: [],
    GridRatio: [],
    Irrig: [],
    Init: [],
    Soil: [],
    Solute: [],
    Time: [],
    Variety: [],
    Weather: [],
    Gas: [],
    MulchDecomp: [],
    MulchGeo: [],
    Tillage: [],
  },
  soilfiles: {},

  // hidden: true,
  // label: '...',
  // unit: '...',
  // description: <>...</>,
  // options: []
  Biology: {
    id: {
      value: '',
      hidden: true,
    },
    es: {
      value: 0.06,
      unit: <>fraction</>,
      description: <>Relative effect of moisture when the soil is saturated</>,
    },
    tb: {
      value: 25,
      unit: <>C</>,
      description: <>Base temperature at which eT =1</>,
    },
    dthh: {
      value: 0.1,
      unit:
  <>
    cm
    <sup>3</sup>
    /cm
    <sup>3</sup>
  </>,
      description: <>The highest volumetric water content for which the process is optimal</>,
    },
    dthl: {
      value: 0.08,
      unit:
  <>
    cm
    <sup>3</sup>
    /cm
    <sup>3</sup>
  </>,
      description: <>The lowest volumetric water content for which the process is optimal</>,
    },
    th_m: {
      value: 1,
      description: <>Exponent in dependencies of e(theta) on theta (water content)</>,
    },
    qt: {
      value: 3,
      description: <>Factor change in rate with a 10&deg; C change in temperature</>,
    },
    dthd: {
      value: 0.1,
      unit:
  <>
    cm
    <sup>3</sup>
    /cm
    <sup>3</sup>
  </>,
      description: <>Threshold water content below which no denitrification occurs</>,
    },
    th_d: {
      value: 2,
      description: <>Exponent in dependencies of e(d) on theta (water content)</>,
    },
  },
  Climate: {
    climateid: {
      value: '',
      hidden: true,
    },
    location: {
      value: '',
      hidden: true,
    },
    latitude: {
      value: '',
      hidden: true,
    },
    longitude: {
      value: '',
      hidden: true,
    },
    dailybulb: {
      value: 'Daily',
      options: ['Daily', 'Hourly'],
      description: <>Switch to indicate if daily or hourly wet bulb temperatures are available.</>,
    },
    dailywind: {
      value: 1,
    },
    rainintensity: {
      value: 0,
    },
    dailyconc: {
      value: 0,
    },
    furrow: {
      value: 0,
    },
    relhumid: {
      value: 1,
    },
    dailyco2: {
      value: 0,
    },
    bsolar: {
      value: 1000000,
    },
    btemp: {
      value: 1,
    },
    atemp: {
      value: 0,
    },
    erain: {
      value: 0.1,
    },
    bwind: {
      value: 1,
    },
    bir: {
      value: 1,
    },
    avgwind: {
      value: 10,
    },
    avgrainrate: {
      value: 3,
    },
    chemconc: {
      value: 0,
    },
    rh: {
      value: 83,
    },
    avgco2: {
      value: 420,
    },
    altitude: {
      value: 1048,
    },
  },
  Fertilization: {
    amount: {
      value: 112,
    },
    depth: {
      value: 5,
    },
    'litter_c(kg/ha)': {
      label: 'litter_c',
      value: 0,
      unit: 'kg/ha',
    },
    litter_n: {
      value: 0,
    },
    manure_c: {
      value: 0,
    },
    manure_n: {
      value: 0,
    },
  },
  GridRatio: {
    soilfile: {
      value: '',
      hidden: true,
    },
    sr1: {
      label: <>Surface nodes spacing ratio</>,
      value: 1.001,
      description:
  <>
    Determines how spacing changes with increasing depth. The closer to 1
    this number (but must be always &gt;1) the more uniform the node spacing
  </>,
    },
    ir1: {
      label: <>Interior nodes spacing ratio</>,
      value: 1,
    },
    sr2: {
      label: <>Surface nodes  mininimum distance</>,
      value: 1.001,
      description: <>initial distance between vertical nodes from the surface to the first layer</>,
    },
    ir2: {
      label: <>Interior nodes minimum distance</>,
      value: 3,
      description: <>initial distance between vertical nodes at a boundary</>,
    },
    plantingdepth: {
      label: <>depth of seed</>,
      value: 5,
      unit: 'cm',
    },
    xlimitroot: {
      label: <>maximum initial rooting depth at emergence (for potato)</>,
      value: 23,
      unit: 'cm',
    },
    bottombc: {
      label: <>Bottom Boundary condition</>,
      value: '1 constant',
      options: ['1 constant', '-2 seepage face', '-7 unit hydraulic gradient drainage'],
    },
    gasbctop: {
      value: -4,
    },
    gasbcbottom: {
      value: 1,
    },
    initrtmass: {
      value: 0,
    },
  },
  Irrigation: { // Irrig
    date: {
      value: undefined,
    },
    amount: {
      value: undefined,
    },
  },
  Soil: {
    bottom_depth: {
      label: <>Bottom Depth</>,
      value: 10,
      unit: <div />,
    },
    om_pct: {
      label: <>Organic Matter</>,
      value: 0.004,
      unit: <>fraction</>,
    },
    no3: {
      label: <>Nitrate</>,
      value: 5,
      unit: <>ug/cm3 (ppm)</>,
    },
    nh4: {
      label: <>Ammonia</>,
      value: 1,
      unit: <>ug/cm3 (ppm)</>,
    },
    hnnew: {
      label: <>Soil Metric Potential</>,
      value: -100,
      unit: <div />,
    },
    tmpr: {
      label: <>Soil temperature</>,
      value: 23,
      unit: <>C</>,
    },
    sand: {
      label: <>Sand Fraction</>,
      value: 55,
      unit: <>%</>,
    },
    silt: {
      label: <>Silt Fraction</>,
      value: 35,
      unit: <>%</>,
    },
    clay: {
      label: <>Clay Fraction</>,
      value: 10,
      unit: <>%</>,
    },
    bd: {
      label: <>Bulk Density of Soil in Horizon</>,
      value: 1.3,
      unit:
  <>
    g/c
    <sup>3</sup>
  </>,
    },
    th33: {
      label: <>Soil Water Content at Capillary Pressure of 330 cm</>,
      value: 0.34,
      unit:
  <>
    cm
    <sup>3</sup>
    /cm
    <sup>3</sup>
  </>,
    },
    th1500: {
      label: <>Soil Water Content at Capillary Pressure of 1500 cm</>,
      value: 0.05,
      unit:
  <>
    cm
    <sup>3</sup>
    /cm
    <sup>3</sup>
  </>,
    },
    thr: {
      label: <>Residual Soil Water Content</>,
      value: 0.02,
      unit:
  <>
    cm
    <sup>3</sup>
    /cm
    <sup>3</sup>
  </>,
    },
    ths: {
      label: <>Saturated Soil Water Content</>,
      value: 0.39,
      unit:
  <>
    cm
    <sup>3</sup>
    /cm
    <sup>3</sup>
  </>,
    },
    tha: {
      label: <>Residual Soil Water content</>,
      value: 0.02,
      unit:
  <>
    cm
    <sup>3</sup>
    /cm
    <sup>3</sup>
  </>,
    },
    th: {
      label: <>Saturated Volumetric Soil Water Content</>,
      value: 0.39,
      unit:
  <>
    cm
    <sup>3</sup>
    /cm
    <sup>3</sup>
  </>,
    },
    alfa: {
      label: <>slope in van Genuchten&apos;s equation</>,
      value: 0.003,
      unit: <div />,
    },
    n: {
      label: <>Measure of the Pore-Size Distribution</>,
      value: 1.2,
      unit: <div />,
    },
    ks: {
      label: <>Saturated Hydraulic Conductivity</>,
      value: 12,
      unit: <>cm/day</>,
    },
    kk: {
      label:
  <>
    Saturated Hydraulic Conductivity for alternanative version of van Genuchten&apos;s
    equation that allows for representing saturated hydrualic conductivity when the soil is near saturation
  </>,
      value: 12,
      unit: <>cm/day</>,
    },
    thk: {
      label: <>Near saturated volumetric water content where Kk is used</>,
      value: 0.39,
      unit:
  <>
    cm
    <sup>3</sup>
    /cm
    <sup>3</sup>
  </>,
    },
    kh: {
      label:
  <>
    Potential mineralization rate fro the stable humus pool, day
    <sup>-1</sup>
  </>,
      value: 0.00007,
      unit:
  <>
    day
    <sup>-1</sup>
  </>,
    },
    kL: {
      label:
  <>
    Potential plant residue decomposition rate, day
    <sup>-1</sup>
  </>,
      value: 0.035,
      unit:
  <>
    day
    <sup>-1</sup>
  </>,
    },
    km: {
      label:
  <>
    Potential rate of the organic fertilizer decomposition, day
    <sup>-1</sup>
  </>,
      value: 0.07,
      unit:
  <>
    day
    <sup>-1</sup>
  </>,
    },
    kn: {
      label:
  <>
    Potential rate of nitrification, day
    <sup>-1</sup>
  </>,
      value: 0.02,
      unit:
  <>
    day
    <sup>-1</sup>
  </>,
    },
    kd: {
      label:
  <>
    Potential rate of denitrification, mg L
    <sup>-1</sup>
    {' '}
    day
    <sup>-1</sup>
  </>,
      value: 0.00001,
      unit:
  <>
    day
    <sup>-1</sup>
  </>,
    },
    fe: {
      label: <>Microbial synthesis efficiency</>,
      value: 0.6,
      unit: <div />,
    },
    fh: {
      label: <>Humification fraction</>,
      value: 0.2,
      unit: <div />,
    },
    r0: {
      label: <>C/N ratio of the decomposer biomass and humification products</>,
      value: 10,
      unit: <div />,
    },
    rl: {
      label: <>C/N ratio of plant residues</>,
      value: 50,
      unit: <div />,
    },
    rm: {
      label: <>C/N ratio of the organic fertilizer</>,
      value: 10,
      unit: <div />,
    },
    fa: {
      label: <>Fraction of the mineral nitrogen available for immobilization</>,
      value: 0.1,
      unit: <div />,
    },
    nq: {
      label: <>Ratio of the mineral nitrate amount to the mineral ammonium amount characteristic to the particular soil material</>,
      value: 8,
      unit: <div />,
    },
    cs: {
      label:
  <>
    Michaelis-Menten constant of denitrification, mg L
    <sup>-1</sup>
  </>,
      value: 0.00001,
      unit:
  <>
    mg L
    <sup>-1</sup>
  </>,
    },

  },
  Solute: {
    id: {
      value: '',
      hidden: true,
    },
    epsi: {
      value: '',
    },
    lupw: {
      value: '',
    },
    courmax: {
      value: '',
    },
    diffusion_coeff: {
      label: 'Diffusion Coefficient',
      value: '',
    },
  },
  Dispersivity: {
    id: {
      value: '',
    },
    texturecl: {
      value: '',
      description: <>Soil texture class, i.e. silty clay, sandy, etc</>,
    },
    alpha: {
      value: '',
      description: <>Tortuosity factor - from the literature</>,
    },
  },
  Corn: {
    id: {
      value: '',
    },
    hybridname: {
      value: '',
      label: <>Hybrid Name</>,
    },
    gdd2mat: {
      value: '',
      label: <>Growing degree days to maturity (not used at this time)</>,
    },
    juvenileleaves: {
      value: 17,
      label: <>Juvenile Leaves</>,
      unit: <>leaves</>,
    },
    croplinkid: {
      value: '',
    },
    DaylengthSensitive: {
      value: 1,
      label: <>1 if variety flowering time depends on daylength</>,
    },
    Rmax_LTAR: {
      value: 0.53,
      label: <>Leaf tip appearance rate at optimum temperature</>,
      unit: <>leaves per day</>,
    },
    Rmax_LTIR: {
      value: 0.978,
      label: <>Leaf tip initiation rate at optimum temperature</>,
      unit: <>leaves per day</>,
    },
    PhyllFrmTassel: {
      value: 3,
      label: <>number of phyllocrons from tassel appearance that silks appear</>,
      unit: <>leaves per day</>,
      description: <>if the time it takes for 3 leaves to appear is the same as the time it takes for the silks to appear after tassel then the value would be 3</>,
    },
    StayGreen: {
      value: 3,
      label: <>relative amount of time that senescence is delayed</>,
      description: <>increasing this value will delay senescense</>,
    },
    LM_Min: {
      value: 110,
      label: <>Potential Length of the longest leaf</>,
      unit: <>cm</>,
    },
    RRRM: {
      value: 166.7,
      label: <>Radial Resistance of Old Roots per cm of Root in Soil Cell</>,
      unit: <>bar.hr/g</>,
    },
    RRRY: {
      value: 31.3,
      label: <>Radial Resistance of Young Roots per cm of Root in Soil Cell</>,
      unit: <>bar.hr/g</>,
    },
    RVRL: {
      value: 0.73,
      label: <>Root Vascylar Resistance per cm of Root</>,
      unit: <>bar.hr/g</>,
    },
    ALPM: {
      value: 0.55,
      label: <>relative growth rate of mature leaves</>,
      unit:
  <>
    day
    <sup>-1</sup>
  </>,
    },
    ALPY: {
      value: 0.04,
      label: <>relative growth rate of young leaves</>,
      unit:
  <>
    day
    <sup>-1</sup>
  </>,
    },
    RTWL: {
      value: 0.0001059,
      label: <>Average Root Dry  Weight per Unit Length</>,
      unit: <>g/cm</>,
    },
    RTMinWTperArea: {
      value: 0.0002,
      label: <>minimum root weight per unit area</>,
      unit: <>g/cm</>,
    },
    EPSI: {
      value: 1,
      label: <>factor to weight N from the previous time step (usually 1 for the current setup)</>,
    },
    lUpW: {
      value: 1,
      label: <>Upstream weighting factor</>,
    },
    CourMax: {
      value: 1,
      label: <>Courant number for weighting time steps</>,
    },
    Diffx: {
      value: 2.4,
      label: <>diffusion coefficient for root growth in the x direction</>,
      unit:
  <>
    day
    <sup>-1</sup>
  </>,
    },
    Diffz: {
      value: 2.9,
      label: <>diffusion coefficient for root growth in the y direction</>,
      unit:
  <>
    day
    <sup>-1</sup>
  </>,
    },
    VelZ: {
      value: 0,
      label: <>downward growth rate in response to gravity</>,
      unit:
  <>
    day
    <sup>-1</sup>
  </>,
    },
    Isink: {
      value: 1,
      label: <>method to calculate sink for nitrogen uptake</>,
    },
    Rroot: {
      value: 0.017,
      unit: <>average radius of root, cn</>,
    },
    ConstI_M: {
      value: 35,
      description: <>These are parameters of the Michalis_Menton equation (see below) for convective - diffusive uptake of N, Maximum uptake rate of NO3, mg d-1 cm root-1 for mature roots</>,
    },
    ConstK_M: {
      value: 0.5,
      unit: <>umolNO3/cm3</>,
      description: <>MM coefficient for mature roots</>,
    },
    Cmin0_M: {
      value: 0.01,
      unit: <>umol NO3/cm3</>,
      description: <>miniumum conc NO3 at the root surface for mature roots</>,
    },
    ConstI_Y: {
      value: 17.2,
      unit: <>mg d-1 cm root-1</>,
      description: <>Maximum uptake rate of NO3, mg d-1 cm root-1 for young roots</>,
    },
    ConstK_Y: {
      value: 0.75,
      unit: <>umolNO3/cm3</>,
      description: <>MM coefficient for young roots</>,
    },
    Cmin0_Y: {
      value: 0.03,
      unit: <>umol NO3/cm3</>,
      description: <>minimum conc NO3 at the root surface for young roots</>,
    },
  },
  Crops: {
    id: {
      value: '',
    },
    cropname: {
      value: '',
      label: <>Crop Name</>,
      options: ['Corn', 'Soybean', 'Potato'],
    },
  },
};

const fetchSSURGOWater = (state) => {
  const { lat, lon } = state;

  state.gotSSURGO = false;

  const url = `https://ssurgo.covercrop-data.org/?lat=${lat}&lon=${lon}&component=major`;

  api({
    url,
    callback: (data) => {
      if (data.ERROR) {
        // console.log(`No SSURGO data at ${lat}, ${lon}`);
        store.dispatch(set.BD(''));
        store.dispatch(set.OM(''));
      } else {
        // store.dispatch(set.BD(weightedAverage(data, 'dbthirdbar_r')));
        // store.dispatch(set.OM(weightedAverage(data, 'om_r')));
        store.dispatch(set.gotSSURGO(true));
        store.dispatch(set.SSURGO(data));
      }
    },
    timer: 'ssurgo',
    delay: 2000,
  });
}; // fetchSSURGOWater

const afterChange = {
  lat: (state) => fetchSSURGOWater(state),
  lon: (state) => fetchSSURGOWater(state),
  site: (state) => {
    const desc = state.xl.Description.find((obj) => obj.path === state.site);

    ['Biology', 'Climate', 'GridRatio', 'Solute'].forEach((type) => {
      let index = 0;

      if (type === 'Climate') {
        index = state.xl.Climate.findIndex((obj) => obj.climateid === desc.climateid);
        console.log(index);
      } else if (type === 'GridRatio') {
        index = state.xl.GridRatio.findIndex((obj) => obj.soilfile === desc.soilfile);
      }

      Object.keys(state.xl[type][index]).forEach((key) => {
        if (key in state[type]) {
          state[type][key].value = state.xl[type][index][key];
        } else {
          console.log(type, key);
        }
      });
    });
  },
}; // afterChange

export const rosetta = (soildata) => {
  const rosettaData = soildata.map((row) => {
    row = [...row];
    row.splice(0, 1); // remove Matnum
    row.splice(4, 1); // remove om
    row.splice(6, 1); // remove 'w'
    row[0] *= 100; // sand
    row[1] *= 100; // silt
    row[2] *= 100; // clay
    delete row.org;
    return row;
  });

  api({
    // url: 'https://www.handbook60.org/api/v1/rosetta/1', // doesn't support CORS
    url: 'https://weather.covercrop-data.org/rosetta',
    options: {
      method: 'post',
      soildata: rosettaData,
    },
    callback: (data) => {
      let s = '           *** Material information ****                                                                   g/g  \r\n';
      s += '   thr       ths         tha       thm     Alfa      n        Ks         Kk       thk       BulkD     OM    Sand    Silt    InitType\r\n';

      data.van_genuchten_params.forEach((d, i) => {
        let [alpha, npar, ksat, theta_s] = d;
        const [theta_r] = d;

        alpha = 10 ** alpha;
        npar = 10 ** npar;
        ksat = 10 ** ksat;

        // eslint-disable-next-line no-unused-vars
        const [Matnum, sand, silt, clay, bd, om, TH33, TH1500, inittype] = soildata[i];

        const theta_m = theta_s;
        let theta_k = theta_s;
        let kk = ksat;

        if (npar > 1 && npar < 2) {
          theta_k -= 0.004;
          kk = ksat - (0.10 * ksat);
          theta_s -= 0.002;
        }

        // if (rosoutput.vgnpar < 2.0 && rosoutput.vgnpar > 1 && count === 1) {
        //   vgthm = rosoutput.vgths;
        //   vgths = rosoutput.vgths - 0.002;
        //   vgthk = rosoutput.vgths - 0.004;
        //   vgkk = rosoutput.ks  - (0.10 * rosoutput.ks);
        // }

        // Heading    JS var    C++ var
        // ________   _______   ____________________
        // thr        theta_r   rosoutput.vgthr
        // ths        theta_s   vgths
        // tha        theta_r   rosoutput.vgthr
        // thm        theta_m   vgthm
        // Alfa       alpha     rosoutput.vgalp
        // n          npar      rosoutput.vgnpar
        // Ks         ksat      rosoutput.ks
        // Kk         kk        vgkk
        // thk        theta_k   vgthk
        // BulkD      bd        rosinput.bd
        // OM         om        OM
        // Sand       sand      rosinput.sand/100.0
        // Silt       silt      rosinput.silt/100.0
        // InitType   inittype  InitType

        s += `    ${theta_r.toFixed(3)}    ${theta_s.toFixed(3)}    ${theta_r.toFixed(3)}    ${theta_m.toFixed(3)}    ${alpha.toFixed(5)}    ${npar.toFixed(5)}    ${ksat.toFixed(3)}    ${kk.toFixed(3)}    ${theta_k.toFixed(3)}    ${bd.toFixed(2)} ${om.toFixed(5)}    ${sand.toFixed(2)}    ${silt.toFixed(2)}   ${inittype}\r\n`;
      });

      const state = store.getState();
      store.dispatch(set.soilfiles({ ...state.soilfiles, 'MeadIr_run_01.soi': s }));
      // console.log('ok');
    },
  });
}; // rosetta

const reducers = {};

export const store = createStore(initialState, { afterChange, reducers });

export const api = ({
  url, options = {}, callback, timer = url, delay = 0,
}) => {
  if (timer) {
    clearTimeout(api[timer]);
  }

  api[timer] = setTimeout(() => {
    // console.log(url);
    store.dispatch({
      type: 'api',
      payload: {
        url,
        options,
        callback,
      },
    });
  }, delay);
}; // api

export { set, get } from './redux-autosetters';
