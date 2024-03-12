import xlsx from 'xlsx';

const baseLocation = '../../../public/CROWN_Geospatial/';

const fileLocations = {
  templates: {
    MD: {
      Frederick_test: `${baseLocation}PSA2023_residueinput_templates/geospatial_template_MD_Frederick_test.xlsx`,
    },
  },
  modelPath: 'PSA2023_residueinput_data',
  modelSubfolders: { // look for files MassBl.out, subfolder.g01 and subfolder.g05 files
    MD: {
      Frederick_test: {
        baseName: 'MDC410_C_',
        startYear: 2008,
        endYear: 2022,
      },
    },
  },
};

export const STATES = [
  {
    state: 'MD',
    counties: ['Frederick_test'],
  },
];

export const getModelPaths = (state, county) => {
  const subfolder = `${baseLocation + fileLocations.modelPath}/${state}/${county}`;
  const subfolderConfig = fileLocations.modelSubfolders[state][county];
  const paths = [];
  for (let year = subfolderConfig.startYear; year <= subfolderConfig.endYear; year++) {
    const location = `${subfolder}/${subfolderConfig.baseName}${year}/`;
    const path = {
      subfolder: subfolderConfig.baseName + year,
      files: {
        MassBL: `${location}MassBl.out`,
        G01: `${location}${subfolderConfig.baseName + year}.g01`,
        G05: `${location}${subfolderConfig.baseName + year}.g05`,
      },
    };
    paths.push(path);
  }
  return paths;
};

const loadExcelFile = async (fileLocation) => {
  try {
    const response = await fetch(fileLocation);
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = xlsx.read(data, { type: 'array' });
    const jsonData = {};
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      jsonData[sheetName] = xlsx.utils.sheet_to_json(sheet);
    });
    return jsonData;
  } catch (error) {
    console.error('Error: ', error);
    return {};
  }
};

const loadObjectFile = async (fileLocation) => {
  try {
    const response = await fetch(fileLocation);
    const text = await response.text();
    const lines = text.split('\n');
    const jsonData = [];
    const columns = [];
    lines.forEach((line, lineIndex) => {
      const fields = line.split(',');
      const value = {};
      let ignore = false;
      fields.forEach((field, fieldIndex) => {
        if (fieldIndex === 0 && field.trim() === '') {
          ignore = true;
        } else if (lineIndex === 0) {
          columns.push(field.trim());
        } else if (fieldIndex < columns.length) {
          value[columns[fieldIndex]] = field.trim();
        }
      });
      if (!ignore && lineIndex !== 0) {
        jsonData.push(value);
      }
    });
    return jsonData;
  } catch (error) {
    console.error('Error: ', error);
    return {};
  }
};

export const loadTemplateFiles = async (state, county) => {
  const data = await loadExcelFile(fileLocations.templates[state][county]);
  return data;
};

export const geospatialProcessing = async (fileDir, init, ccTerminationDate) => {
  const checkDuplicateJson = (arrObj, valueToCheck) => arrObj.some((obj) => JSON.stringify(obj) === JSON.stringify(valueToCheck));

  const checkJoinCondition = (record1, record2, byColumns1, byColumns2) => {
    for (let it = 0; it < byColumns1.length; it++) {
      if (!(
        (
          [byColumns1[it], byColumns2[it]].includes('Date')
              && record1[byColumns1[it]].getTime() === record2[byColumns2[it]].getTime()
        ) || (
          record1[byColumns1[it]] === record2[byColumns2[it]]
        )
      )) {
        return false;
      }
    }
    return true;
  };

  const leftJoin = (table1, table2, byColumns1, byColumns2) => {
    const newData = [];
    const columns = Array.from(new Set([...Object.keys(table1[0]), ...Object.keys(table2[0])]));
    table1.forEach((t1) => {
      let match = false;
      table2.forEach((t2) => {
        if (checkJoinCondition(t1, t2, byColumns1, byColumns2)) {
          match = true;
          const newObj = {};
          columns.forEach((col) => {
            newObj[col] = t1[col] || t2[col] || null;
          });
          newData.push(newObj);
        }
      });
      if (!match) {
        const newObj = {};
        columns.forEach((col) => {
          newObj[col] = t1[col] || null;
        });
        newData.push(newObj);
      }
    });
    return newData;
  };

  const hasNonNullValues = (record) => Object.values(record).some((val) => val !== null && val !== undefined && val !== 0);

  const groupBy = (data, column) => {
    const newData = data.reduce((acc, record) => {
      const key = record[column];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(record);
      return acc;
    }, []);
    return newData;
  };

  const fullJoin = (table1, table2, byColumns1, byColumns2) => {
    table1 = [...table1];
    table2 = [...table2];
    table1.forEach((recordT1) => {
      table2.forEach((recordT2) => {
        if (checkJoinCondition(recordT1, recordT2, byColumns1, byColumns2)) {
          recordT2.existing = true;
        }
      });
    });
    table2.forEach((record) => {
      if (!record.existing) {
        const newObj = {};
        Object.keys(table1[0]).forEach((k) => {
          newObj[k] = record[k] || null;
        });
        table1.push(newObj);
      }
    });
    return table1;
  };

  const fillUpDown = (arr, col, index) => {
    let upIndex = index - 1;
    let downIndex = index + 1;
    while (upIndex >= 0 || downIndex < arr.length) {
      if (downIndex >= arr.length) {
        if (arr[upIndex][col]) {
          return arr[upIndex][col];
        }
        upIndex -= 1;
      } else if (upIndex < 0) {
        if (arr[downIndex][col]) {
          return arr[downIndex][col];
        }
        downIndex += 1;
      } else {
        if (arr[upIndex][col]) {
          return arr[upIndex][col];
        } if (arr[downIndex][col]) {
          return arr[downIndex][col];
        }
        upIndex -= 1;
        downIndex += 1;
      }
    }
    return arr[index][col];
  };

  const pivotWider = (data, nameColumn, staticColumn) => {
    const staticID = Array.from(new Set(data.map((record) => record[staticColumn])));
    const newKeys = [];
    const nameColumnValues = Array.from(new Set(data.map((record) => record[nameColumn])));
    Object.keys(data[0]).forEach((key) => {
      if (![nameColumn, staticColumn].includes(key)) {
        nameColumnValues.forEach((value) => {
          newKeys.push(`${key}_${value}`);
        });
      }
    });
    const output = [];
    staticID.forEach((newID) => {
      nameColumnValues.forEach((column) => {
        const newObj = { [staticColumn]: newID };
        newKeys.forEach((newKey) => {
          if (newKey.includes(column)) {
            const oldKey = newKey.replace(`_${column}`, '');
            const filteredValue = data.filter(
              (record) => record[staticColumn] === newID && record[nameColumn] === column,
            );
            newObj[newKey] = filteredValue.length > 0 ? filteredValue[0][oldKey] || null : null;
          } else {
            newObj[newKey] = null;
          }
        });
        output.push(newObj);
      });
    });
    return output;
  };

  init = init.map((record) => ({
    ID: record.ID,
    lat: record.lat,
    long: record.long,
    altitude: record['altitude(m)'],
    population: record['population(p/ha)'],
    end: record.end,
    end_date: new Date(record.end),
    ID_new: record.ID.replace(/_.*_/, '_'),
  }));

  ccTerminationDate = ccTerminationDate.map((record) => ({
    ID_new: record.ID.replace(/_.*_/, '_'),
    date_residue: record.date_residue,
  }));
  const uniqueTerminationDate = [];
  ccTerminationDate.forEach((cc) => {
    if (!checkDuplicateJson(uniqueTerminationDate, cc)) {
      uniqueTerminationDate.push(cc);
    }
  });
  ccTerminationDate = uniqueTerminationDate;

  // full join between init and ccTerminationDate
  const modelInputData = [];
  init.forEach((i) => {
    ccTerminationDate.forEach((cc) => {
      if (i.ID_new === cc.ID_new) {
        const value = {
          ID: i.ID,
          lat: i.lat,
          long: i.long,
          altitude: i.altitude,
          population: i.population,
          end_date: i.end_date,
          date_residue: new Date(cc.date_residue),
          management: 'cc_termination',
        };
        modelInputData.push(value);
      }
    });
  });

  // model out processing by going through each input folder
  let modelOut = [];
  await Promise.all(
    fileDir.map(async (inputFile) => {
      const massBl = await loadObjectFile(inputFile.files.MassBL);
      const g01File = await loadObjectFile(inputFile.files.G01);
      const g05File = await loadObjectFile(inputFile.files.G05);

      // processing for allPlantDataG01
      let allPlantDataG01 = [];
      g01File.forEach((record) => {
        const value = {
          ...record,
          Date: new Date(record.date),
          date_time: (() => {
            const d = new Date(record.date);
            d.setHours(record.time);
            return d;
          })(),
          Note: record.Note.replace(/"/g, ''),
          crop_stage: record.Note.replace(/"/g, ''),
          N_dmd: record.N_Dem,
          N_upt: record.NUpt,
          GDD: (Math.min(record.Tair, 30) - 10) / 24,
          ID: (() => {
            const p = (inputFile.files.G01).split('/');
            return p[p.length - 1].replace('.g01', '');
          })(),
        };
        allPlantDataG01.push(value);
      });
      allPlantDataG01.sort((a, b) => a.date_time - b.date_time);
      if (allPlantDataG01[allPlantDataG01.length - 1].crop_stage !== 'Matured') {
        allPlantDataG01[allPlantDataG01.length - 1].crop_stage = 'Sim_ended';
      }
      let maturedCounter = 0;
      allPlantDataG01 = allPlantDataG01.map((record) => {
        if (record.crop_stage === 'Matured') {
          maturedCounter += 1;
        }
        return {
          ...record,
          cumSumCropStageMatured: maturedCounter,
        };
      });
      allPlantDataG01 = allPlantDataG01.filter(
        (record) => record.cumSumCropStageMatured <= 1,
      ).map((record) => {
        delete record.cumSumCropStageMatured;
        return record;
      });
      const maxLAI = allPlantDataG01.reduce((currentMax, obj) => Math.max(currentMax, Number(obj.LAI)), Number.NEGATIVE_INFINITY);
      let cumETdmd = 0;
      let cumETsply = 0;
      let GDDsum = 0;
      allPlantDataG01 = allPlantDataG01.map((record) => {
        cumETdmd += Number(record.ETdmd);
        cumETsply += Number(record.ETsply);
        GDDsum += Number(record.GDD);
        return {
          ...record,
          max_LAI: maxLAI,
          cum_ETdmd: cumETdmd,
          cum_ETsply: cumETsply,
          GDDSum: GDDsum,
        };
      });
      allPlantDataG01 = groupBy(allPlantDataG01, 'crop_stage');
      allPlantDataG01 = Object.values(allPlantDataG01).map((group) => group[0]);
      allPlantDataG01.map((record) => {
        if (record.crop_stage === 'none') {
          record.crop_stage = 'Sowing';
        }
        return 0;
      });
      allPlantDataG01.sort((a, b) => a.Date - b.Date);
      allPlantDataG01 = allPlantDataG01.map((record) => ({
        ID: record.ID,
        crop_stage: record.crop_stage,
        Date: record.Date,
        LAI: record.LAI,
        totalDM: record.totalDM,
        shootDM: record.shootDM,
        earDM: record.earDM,
        TotLeafDM: record.TotLeafDM,
        DrpLfDM: record.DrpLfDM,
        stemDM: record.stemDM,
        rootDM: record.rootDM,
        N_dmd: record.N_dmd,
        N_upt: record.N_upt,
        max_LAI: record.max_LAI,
        cum_ETdmd: record.cum_ETdmd,
        cum_ETsply: record.cum_ETsply,
        GDDSum: record.GDDSum,
      }));

      // prcoessing for allAtmosDataG05
      let allAtmosDataG05 = g05File.map(({ Date_time, ...rest }) => ({
        ...rest,
        ID: (() => {
          const p = (inputFile.files.G05).split('/');
          return p[p.length - 1].replace('.g05', '');
        })(),
        Date: new Date(rest.Date),
      }));
      allAtmosDataG05.sort((a, b) => a.Date - b.Date);
      allAtmosDataG05 = allAtmosDataG05.map((record, index) => ({
        ID: record.ID,
        Date: record.Date,
        SeasPSoEv: record.SeasPSoEv,
        SeasASoEv: record.SeasASoEv,
        SeasPTran: record.SeasPTran,
        SeasATran: record.SeasATran,
        SeasRain: record.SeasRain,
        SeasInfil: record.SeasInfil,
        G05_End: index === allAtmosDataG05.length - 1 ? 'G05_End' : 'NA',
      }));

      // processing for allMassBlData
      let allMassBlData = massBl.map((record) => ({
        ID: (() => {
          const p = (inputFile.files.MassBL).split('/');
          return p[p.length - 2];
        })(),
        Date: new Date(record.Date),
        Inorg_N: Number(record.Min_N) + Number(record.Ammon_N),
        Litr_N: Number(record.Litter_N),
        Mul_N: Number(record.Tot_res_N),
        NO3_lch: Number(record.CFlux),
        Mul_Mass: record.Mul_Mass,
        Mul_CNR: record.Mul_CNR,
      }));
      allMassBlData.sort((a, b) => a.Date - b.Date);
      allMassBlData = allMassBlData.map((record, index) => ({
        ...record,
        MsBl_End: index === (allMassBlData.length - 1) ? 'MsBl_End' : 'NA',
      }));

      // processing for allOut
      try {
        let allOut = allPlantDataG01.map((record) => ({ ...record }));
        const allOutIds = allOut.map((record) => record.ID);
        const sampleModelInputData = modelInputData.map((record) => ({
          ID: record.ID,
          crop_stage: record.management,
          Date: record.date_residue,
        })).filter((record) => allOutIds.includes(record.ID));
        allOut = fullJoin(allOut, sampleModelInputData, ['ID', 'crop_stage', 'Date'], ['ID', 'crop_stage', 'Date']);
        allOut.sort((a, b) => a.Date - b.Date);
        const allOutJoin1 = leftJoin(allOut, allAtmosDataG05, ['ID', 'Date'], ['ID', 'Date']);
        let allOutJoin2 = leftJoin(allOutJoin1, allMassBlData, ['ID', 'Date'], ['ID', 'Date']);
        const endAtmosG05 = allAtmosDataG05.filter((record) => record.G05_End === 'G05_End');
        allOutJoin2 = fullJoin(
          allOutJoin2,
          endAtmosG05,
          ['ID', 'Date', 'SeasPSoEv', 'SeasASoEv', 'SeasPTran', 'SeasATran', 'SeasRain', 'SeasInfil', 'GO5_End'],
          ['ID', 'Date', 'SeasPSoEv', 'SeasASoEv', 'SeasPTran', 'SeasATran', 'SeasRain', 'SeasInfil', 'GO5_End'],
        );
        allOut = allOutJoin2.map((record) => ({
          ...record,
          crop_stage: !record.crop_stage || ['NA', ''].includes(record.crop_stage) ? record.G05_End : record.crop_stage,
        }));
        const fillColumnsAtmos = ['SeasPSoEv', 'SeasASoEv', 'SeasPTran', 'SeasATran', 'SeasRain', 'SeasInfil'];
        allOut.forEach((record, recordIndex) => {
          fillColumnsAtmos.forEach((col) => {
            if (!record[col]) {
              record[col] = fillUpDown(allOut, col, recordIndex);
            }
          });
        });
        const endMassBl = allMassBlData.filter((record) => record.MsBl_End === 'MsBl_End');
        allOut.forEach((recordAllOut) => {
          if (recordAllOut.Mul_N === null) {
            recordAllOut.Mul_N = 0;
          }
          if (recordAllOut.Litr_N === null) {
            recordAllOut.Litr_N = 0;
          }
        });
        allOut = fullJoin(
          allOut,
          endMassBl,
          ['ID', 'Date', 'Inorg_N', 'Litr_N', 'Mul_N', 'NO3_lch', 'Mul_Mass', 'Mul_CNR', 'MsBl_End'],
          ['ID', 'Date', 'Inorg_N', 'Litr_N', 'Mul_N', 'NO3_lch', 'Mul_Mass', 'Mul_CNR', 'MsBl_End'],
        );
        allOut = allOut.map((record) => ({
          ...record,
          crop_stage: !record.crop_stage || ['NA', ''].includes(record.crop_stage) ? record.MsBl_End : record.crop_stage,
        }));
        const fillColumnsMassBl = ['Inorg_N', 'Litr_N', 'Mul_N', 'NO3_lch', 'Mul_Mass', 'Mul_CNR'];
        allOut.forEach((record, recordIndex) => {
          fillColumnsMassBl.forEach((col) => {
            if (!record[col]) {
              record[col] = fillUpDown(allOut, col, recordIndex);
            }
          });
        });
        const uniqueAllOut = [];
        allOut.forEach((record) => {
          if (!checkDuplicateJson(uniqueAllOut, record)) {
            uniqueAllOut.push(record);
          }
        });
        modelOut = [...modelOut, ...uniqueAllOut];
      } catch (error) {
        console.log('Error occurred, skipping to the next iteration');
      }
      return 0;
    }),
  );
  // add row logic
  const cropStageValues = [
    'cc_termination', 'Sowing', 'Germinated', 'Emerged', 'Tasselinit', 'Tasseled', 'Silked', 'Matured', 'Sim_ended', 'G05_End', 'MsBl_End',
  ];
  cropStageValues.forEach((cropStage) => {
    const newObject = {};
    Object.keys(modelOut[0]).forEach((key) => {
      if (key === 'crop_stage') {
        newObject[key] = cropStage;
      } else {
        newObject[key] = null;
      }
    });
    modelOut.push(newObject);
  });

  // processing for cornOut
  const filteredModelOutForCorn = modelOut.filter((record) => ['Matured', 'Sim_ended'].includes(record.crop_stage));
  let cornOut = leftJoin(filteredModelOutForCorn, modelInputData, ['ID'], ['ID']);
  cornOut = cornOut.map((record) => ({
    ID: record.ID,
    lat: record.lat,
    long: record.long,
    max_LAI: record.max_LAI,
    LAI: record.LAI,
    totalDM: Number((((Number(record.totalDM) || 0) * Number(record.population)) / 1000).toFixed(2)),
    shootDM: Number((((Number(record.shootDM) || 0) * Number(record.population)) / 1000).toFixed(2)),
    earDM: Number((((Number(record.earDM) || 0) * Number(record.population)) / 1000).toFixed(2)),
    TotLfDm: Number((((Number(record.TotLeafDM) || 0) * Number(record.population)) / 1000).toFixed(2)),
    DrpLfDm: Number((((Number(record.DrpLfDM) || 0) * Number(record.population)) / 1000).toFixed(2)),
    stemDM: Number((((Number(record.stemDM) || 0) * Number(record.population)) / 1000).toFixed(2)),
    rootDM: Number((((Number(record.rootDM) || 0) * Number(record.population)) / 1000).toFixed(2)),
    N_upt: Number((((Number(record.N_upt) || 0) * Number(record.population)) / 1000).toFixed(2)),
    cum_ETsp: Number((((Number(record.cum_ETsply) || 0) * Number(record.population) * 1000) / (10000 * 1000 * 1000)).toFixed(2)),
    cum_Nlch: Number((Number(record.NO3_lch)).toFixed(2)),
    GDDSum: record.GDDSum,
  }));
  cornOut.forEach((record) => {
    record.yield = Number((((Number(record.earDM) || 0) * 86) / 100).toFixed(2));
  });
  cornOut = cornOut.filter((record) => hasNonNullValues(record));

  // processing for water out
  let waterOut = modelOut.map((record) => ({
    ID: record.ID,
    crop_stage: record.crop_stage,
    Date: record.Date,
    SeasPSoEv: record.SeasPSoEv,
    SeasASoEv: record.SeasASoEv,
    SeasPTran: record.SeasPTran,
    SeasATran: record.SeasATran,
    SeasRain: record.SeasRain,
    SeasInfil: record.SeasInfil,
  }));
  let newWaterOut = pivotWider(waterOut, 'crop_stage', 'ID');
  newWaterOut = leftJoin(newWaterOut, modelInputData, ['ID'], ['ID']);
  waterOut = newWaterOut.map((record) => ({
    dt_cct: record.Date_cc_termination,
    dt_Sow: record.Date_Sowing,
    dt_Gmn: record.Date_Germinated,
    dt_Emg: record.Date_Emerged,
    dt_Tsint: record.Date_Tasselinit,
    dt_Tsl: record.Date_Tasseled,
    dt_Slk: record.Date_Silked,
    dt_Gf: record.Date_grainFill,
    dt_Mat: record.Date_Matured,
    dt_SiEnd: record.Date_Sim_ended,
    G05_End: new Date(record.Date_G05_End),
    MsBl_End: new Date(record.Date_MsBl_End),
    P_Ev_B4P: Number(((Number(record.SeasPSoEv_Sowing) || 0) - (Number(record.SeasPSoEv_cc_termination) || 0)).toFixed(2)),
    P_Ev_EVg: Number(((Number(record.SeasPSoEv_Tasselinit) || 0) - (Number(record.SeasPSoEv_Sowing) || 0)).toFixed(2)),
    P_Ev_LVg: Number(((Number(record.SeasPSoEv_Silked) || 0) - (Number(record.SeasPSoEv_Tasselinit) || 0)).toFixed(2)),
    P_Ev_Slk: Number(((Number(record.SeasPSoEv_grainFill) || 0) - (Number(record.SeasPSoEv_Silked) || 0)).toFixed(2)),
    P_Ev_Gf: Number(
      (record.SeasPSoEv_Matured
        ? Number(record.SeasPSoEv_Sim_ended) || 0
        : Number(record.SeasPSoEv_Matured) || 0
      ) - (Number(record.SeasPSoEv_grainFill) || 0).toFixed(2),
    ),
    P_Ev_Veg: Number(((Number(record.SeasPSoEv_Silked) || 0) - (Number(record.SeasPSoEv_Sowing) || 0)).toFixed(2)),
    P_Ev_Rep: Number((
      (record.SeasPSoEv_Matured
        ? Number(record.SeasPSoEv_Sim_ended) || 0
        : Number(record.SeasPSoEv_Matured) || 0
      ) - (Number(record.SeasPSoEv_Silked) || 0)).toFixed(2)),
    P_Ev_cum: Number((
      (record.SeasPSoEv_Matured
        ? Number(record.SeasPSoEv_Sim_ended) || 0
        : Number(record.SeasPSoEv_Matured) || 0
      ) - (Number(record.SeasPSoEv_Sowing) || 0)).toFixed(2)),
    A_Ev_B4P: Number(((Number(record.SeasASoEv_Sowing) || 0) - (Number(record.SeasASoEv_cc_termination) || 0)).toFixed(2)),
    A_Ev_EVg: Number(((Number(record.SeasASoEv_Tasselinit) || 0) - (Number(record.SeasASoEv_Sowing) || 0)).toFixed(2)),
    A_Ev_LVg: Number(((Number(record.SeasASoEv_Silked) || 0) - (Number(record.SeasASoEv_Tasselinit) || 0)).toFixed(2)),
    A_Ev_Slk: Number(((Number(record.SeasASoEv_grainFill) || 0) - (Number(record.SeasASoEv_Silked) || 0)).toFixed(2)),
    A_Ev_Gf: Number((
      (record.SeasASoEv_Matured
        ? Number(record.SeasASoEv_Sim_ended) || 0
        : Number(record.SeasASoEv_Matured) || 0
      ) - (Number(record.SeasASoEv_grainFill) || 0)).toFixed(2)),
    A_Ev_Veg: Number(((Number(record.SeasASoEv_Silked) || 0) - (Number(record.SeasASoEv_Sowing) || 0)).toFixed(2)),
    A_Ev_Rep: Number((
      (record.SeasASoEv_Matured
        ? Number(record.SeasASoEv_Sim_ended) || 0
        : Number(record.SeasASoEv_Matured) || 0
      ) - (Number(record.SeasASoEv_Silked) || 0)).toFixed(2)),
    A_Ev_cum: Number((
      (record.SeasASoEv_Matured
        ? Number(record.SeasASoEv_Sim_ended) || 0
        : Number(record.SeasASoEv_Matured) || 0
      ) - (Number(record.SeasASoEv_Sowing) || 0)).toFixed(2)),
    P_Tr_B4P: Number(((Number(record.SeasPTran_Sowing) || 0) - (Number(record.SeasPTran_cc_termination) || 0)).toFixed(2)),
    P_Tr_EVg: Number(((Number(record.SeasPTran_Tasselinit) || 0) - (Number(record.SeasPTran_Sowing) || 0)).toFixed(2)),
    P_Tr_LVg: Number(((Number(record.SeasPTran_Silked) || 0) - (Number(record.SeasPTran_Tasselinit) || 0)).toFixed(2)),
    P_Tr_Slk: Number(((Number(record.SeasPTran_grainFill) || 0) - (Number(record.SeasPTran_Silked) || 0)).toFixed(2)),
    P_Tr_Gf: Number((
      (record.SeasPTran_Matured
        ? Number(record.SeasPTran_Sim_ended) || 0
        : Number(record.SeasPTran_Matured) || 0
      ) - (Number(record.SeasPTran_grainFill) || 0)).toFixed(2)),
    P_Tr_Veg: Number(((Number(record.SeasPTran_Silked) || 0) - (Number(record.SeasPTran_Sowing) || 0)).toFixed(2)),
    P_Tr_Rep: Number((
      (record.SeasPTran_Matured
        ? Number(record.SeasPTran_Sim_ended) || 0
        : Number(record.SeasPTran_Matured) || 0
      ) - (Number(record.SeasPTran_Silked) || 0)).toFixed(2)),
    P_Tr_cum: Number((
      (record.SeasPTran_Matured
        ? Number(record.SeasPTran_Sim_ended) || 0
        : Number(record.SeasPTran_Matured) || 0
      ) - (Number(record.SeasPTran_Sowing) || 0)).toFixed(2)),
    A_Tr_B4P: Number(((Number(record.SeasATran_Sowing) || 0) - (Number(record.SeasATran_cc_termination) || 0)).toFixed(2)),
    A_Tr_EVg: Number(((Number(record.SeasATran_Tasselinit) || 0) - (Number(record.SeasATran_Sowing) || 0)).toFixed(2)),
    A_Tr_LVg: Number(((Number(record.SeasATran_Silked) || 0) - (Number(record.SeasATran_Tasselinit) || 0)).toFixed(2)),
    A_Tr_Slk: Number(((Number(record.SeasATran_grainFill) || 0) - (Number(record.SeasATran_Silked) || 0)).toFixed(2)),
    A_Tr_Gf: Number((
      (record.SeasATran_Matured
        ? Number(record.SeasATran_Sim_ended) || 0
        : Number(record.SeasATran_Matured) || 0
      ) - (Number(record.SeasATran_grainFill) || 0)).toFixed(2)),
    A_Tr_Veg: Number(((Number(record.SeasATran_Silked) || 0) - (Number(record.SeasATran_Sowing) || 0)).toFixed(2)),
    A_Tr_Rep: Number((
      (record.SeasATran_Matured
        ? Number(record.SeasATran_Sim_ended) || 0
        : Number(record.SeasATran_Matured) || 0
      ) - (Number(record.SeasATran_Silked) || 0)).toFixed(2)),
    A_Tr_cum: Number((
      (record.SeasATran_Matured
        ? Number(record.SeasATran_Sim_ended) || 0
        : Number(record.SeasATran_Matured) || 0
      ) - (Number(record.SeasATran_Sowing) || 0)).toFixed(2)),
    Rain_B4P: Number(((Number(record.SeasRain_Sowing) || 0) - (Number(record.SeasRain_cc_termination) || 0)).toFixed(2)),
    Rain_EVg: Number(((Number(record.SeasRain_Tasselinit) || 0) - (Number(record.SeasRain_Sowing) || 0)).toFixed(2)),
    Rain_LVg: Number(((Number(record.SeasRain_Silked) || 0) - (Number(record.SeasRain_Tasselinit) || 0)).toFixed(2)),
    Rain_Slk: Number(((Number(record.SeasRain_grainFill) || 0) - (Number(record.SeasRain_Silked) || 0)).toFixed(2)),
    Rain_Gf: Number((
      (record.SeasRain_Matured
        ? Number(record.SeasRain_Sim_ended) || 0
        : Number(record.SeasRain_Matured) || 0
      ) - (Number(record.SeasRain_grainFill) || 0)).toFixed(2)),
    Rain_Veg: Number(((Number(record.SeasRain_Silked) || 0) - (Number(record.SeasRain_Sowing) || 0)).toFixed(2)),
    Rain_Rep: Number((
      (record.SeasRain_Matured
        ? Number(record.SeasRain_Sim_ended) || 0
        : Number(record.SeasRain_Matured) || 0
      ) - (Number(record.SeasRain_Silked) || 0)).toFixed(2)),
    Rain_cum: Number((
      (record.SeasRain_Matured
        ? Number(record.SeasRain_Sim_ended) || 0
        : Number(record.SeasRain_Matured) || 0
      ) - (Number(record.SeasRain_Sowing) || 0)).toFixed(2)),
    Infl_B4P: Number(((Number(record.SeasInfil_Sowing) || 0) - (Number(record.SeasInfil_cc_termination) || 0)).toFixed(2)),
    Infl_EVg: Number(((Number(record.SeasInfil_Tasselinit) || 0) - (Number(record.SeasInfil_Sowing) || 0)).toFixed(2)),
    Infl_LVg: Number(((Number(record.SeasInfil_Silked) || 0) - (Number(record.SeasInfil_Tasselinit) || 0)).toFixed(2)),
    Infl_Slk: Number(((Number(record.SeasInfil_grainFill) || 0) - (Number(record.SeasInfil_Silked) || 0)).toFixed(2)),
    Infl_Gf: Number((
      (record.SeasInfil_Matured
        ? Number(record.SeasInfil_Sim_ended) || 0
        : Number(record.SeasInfil_Matured) || 0
      ) - (Number(record.SeasInfil_grainFill) || 0)).toFixed(2)),
    Infl_Veg: Number(((Number(record.SeasInfil_Silked) || 0) - (Number(record.SeasInfil_Sowing) || 0)).toFixed(2)),
    Infl_Rep: Number((
      (record.SeasInfil_Matured
        ? Number(record.SeasInfil_Sim_ended) || 0
        : Number(record.SeasInfil_Matured) || 0
      ) - (Number(record.SeasInfil_Silked) || 0)).toFixed(2)),
    Infl_cum: Number((
      (record.SeasInfil_Matured
        ? Number(record.SeasInfil_Sim_ended) || 0
        : Number(record.SeasInfil_Matured) || 0
      ) - (Number(record.SeasInfil_Sowing) || 0)).toFixed(2)),
    ID: record.ID,
    GO5_End: record.GO5_End,
  }));
  waterOut = waterOut.filter((record) => hasNonNullValues(record));

  // processing for stress out
  let stressOut = leftJoin(modelOut, modelInputData, ['ID'], ['ID']);
  stressOut = stressOut.map((record) => ({
    N_dmd: Number(((Number(record.N_dmd) * Number(record.population)) / 1000).toFixed(2)),
    N_upt: Number(((Number(record.N_upt) * Number(record.population)) / 1000).toFixed(2)),
    cum_ETdmd: Number(Number(record.cum_ETdmd).toFixed(2)),
    cum_ETsply: Number(Number(record.cum_ETsply).toFixed(2)),
    ID: record.ID,
    crop_stage: record.crop_stage,
  }));
  stressOut = pivotWider(stressOut, 'crop_stage', 'ID');
  stressOut = stressOut.map((record) => ({
    WSI_EVg: Number(
      (
        ((Number(record.cum_ETsply_Tasselinit) || 0) - (Number(record.cum_ETsply_Sowing) || 0))
        / ((Number(record.cum_ETdmd_Tasselinit) || 0) - (Number(record.cum_ETdmd_Sowing) || 0))
      ).toFixed(3),
    ),
    WSI_LVg: Number(
      (
        ((Number(record.cum_ETsply_Silked) || 0) - (Number(record.cum_ETsply_Tasselinit) || 0))
        / ((Number(record.cum_ETdmd_Silked) || 0) - (Number(record.cum_ETdmd_Tasselinit) || 0))
      ).toFixed(3),
    ),
    WSI_Slk: Number(
      (
        ((Number(record.cum_ETsply_grainFill) || 0) - (Number(record.cum_ETsply_Silked) || 0))
        / ((Number(record.cum_ETdmd_grainFill) || 0) - (Number(record.cum_ETdmd_Silked) || 0))
      ).toFixed(3),
    ),
    WSI_Gf: Number(
      (
        (
          (record.cum_ETsply_Matured
            ? (Number(record.cum_ETsply_Sim_ended) || 0)
            : (Number(record.cum_ETsply_Matured) || 0))
          - (Number(record.cum_ETsply_grainFill) || 0)
        ) / (
          (record.cum_ETdmd_Matured
            ? (Number(record.cum_ETdmd_Sim_ended) || 0)
            : (Number(record.cum_ETdmd_Matured) || 0))
          - (Number(record.cum_ETdmd_grainFill) || 0)
        )
      ).toFixed(3),
    ),
    WSI_Veg: Number(
      (
        ((Number(record.cum_ETsply_Silked) || 0) - (Number(record.cum_ETsply_Sowing) || 0))
        / ((Number(record.cum_ETdmd_Silked) || 0) - (Number(record.cum_ETdmd_Sowing) || 0))
      ).toFixed(3),
    ),
    WSI_Rep: Number(
      (
        (
          (record.cum_ETsply_Matured
            ? (Number(record.cum_ETsply_Sim_ended) || 0)
            : (Number(record.cum_ETsply_Matured) || 0))
          - (Number(record.cum_ETsply_Silked) || 0)
        ) / (
          (record.cum_ETdmd_Matured
            ? (Number(record.cum_ETdmd_Sim_ended) || 0)
            : (Number(record.cum_ETdmd_Matured) || 0))
          - (Number(record.cum_ETdmd_Silked) || 0)
        )
      ).toFixed(3),
    ),
    WSI_cum: Number(
      (
        (
          (record.cum_ETsply_Matured
            ? (Number(record.cum_ETsply_Sim_ended) || 0)
            : (Number(record.cum_ETsply_Matured) || 0))
          - (Number(record.cum_ETsply_Sowing) || 0)
        ) / (
          (record.cum_ETdmd_Matured
            ? (Number(record.cum_ETdmd_Sim_ended) || 0)
            : (Number(record.cum_ETdmd_Matured) || 0))
          - (Number(record.cum_ETdmd_Sowing) || 0)
        )
      ).toFixed(3),
    ),
    NSI_EVg: Number(
      (
        ((Number(record.N_upt_Tasselinit) || 0) - (Number(record.N_upt_Sowing) || 0))
        / ((Number(record.N_dmd_Tasselinit) || 0) - (Number(record.N_dmd_Sowing) || 0))
      ).toFixed(3),
    ),
    NSI_LVg: Number(
      (
        ((Number(record.N_upt_Silked) || 0) - (Number(record.N_upt_Tasselinit) || 0))
        / ((Number(record.N_dmd_Silked) || 0) - (Number(record.N_dmd_Tasselinit) || 0))
      ).toFixed(3),
    ),
    NSI_Slk: Number(
      (
        ((Number(record.N_upt_grainFill) || 0) - (Number(record.N_upt_Silked) || 0))
        / ((Number(record.N_dmd_grainFill) || 0) - (Number(record.N_dmd_Silked) || 0))
      ).toFixed(3),
    ),
    NSI_Gf: Number(
      (
        (
          (record.N_upt_Matured
            ? (Number(record.N_upt_Sim_ended) || 0)
            : (Number(record.N_upt_Matured) || 0))
          - (Number(record.N_upt_grainFill) || 0)
        ) / (
          (record.N_dmd_Matured
            ? (Number(record.N_dmd_Sim_ended) || 0)
            : (Number(record.N_dmd_Matured) || 0))
          - (Number(record.N_dmd_grainFill) || 0)
        )
      ).toFixed(3),
    ),
    NSI_Veg: Number(
      (
        ((Number(record.N_upt_Silked) || 0) - (Number(record.N_upt_Sowing) || 0))
        / ((Number(record.N_dmd_Silked) || 0) - (Number(record.N_dmd_Sowing) || 0))
      ).toFixed(3),
    ),
    NSI_Rep: Number(
      (
        (
          (record.N_upt_Matured
            ? (Number(record.N_upt_Sim_ended) || 0)
            : (Number(record.N_upt_Matured) || 0))
          - (Number(record.N_upt_Silked) || 0)
        ) / (
          (record.N_dmd_Matured
            ? (Number(record.N_dmd_Sim_ended) || 0)
            : (Number(record.N_dmd_Matured) || 0))
          - (Number(record.N_dmd_Silked) || 0)
        )
      ).toFixed(3),
    ),
    NSI_cum: Number(
      (
        (
          (record.N_upt_Matured
            ? (Number(record.N_upt_Sim_ended) || 0)
            : (Number(record.N_upt_Matured) || 0))
          - (Number(record.N_upt_Sowing) || 0)
        ) / (
          (record.N_dmd_Matured
            ? (Number(record.N_dmd_Sim_ended) || 0)
            : (Number(record.N_dmd_Matured) || 0))
          - (Number(record.N_dmd_Sowing) || 0)
        )
      ).toFixed(3),
    ),
    ID: record.ID,
  }));
  stressOut = stressOut.filter((record) => hasNonNullValues(record));

  // processing for nitrogen out
  let nitrogenOut = leftJoin(modelOut, modelInputData, ['ID'], ['ID']);
  nitrogenOut = nitrogenOut.map((record) => ({
    N_dmd: Number((((Number(record.N_dmd) || 0) * record.population) / 1000).toFixed(2)),
    N_upt: Number((((Number(record.N_upt) || 0) * record.population) / 1000).toFixed(2)),
    ID: record.ID,
    crop_stage: record.crop_stage,
    Inorg_N: record.Inorg_N,
    Litr_N: record.Litr_N,
    Mul_N: record.Mul_N,
    Mul_Mass: record.Mul_Mass,
    Mul_CNR: record.Mul_CNR,
  }));
  nitrogenOut = pivotWider(nitrogenOut, 'crop_stage', 'ID');
  nitrogenOut = nitrogenOut.map((record) => ({
    In_N_cct: record.Inorg_N_cc_termination,
    In_N_Sow: record.Inorg_N_Sowing,
    In_N_LVg: record.Inorg_N_Tasselinit,
    In_N_Slk: record.Inorg_N_Silked,
    In_N_Res: record.Inorg_N_Matured ? record.Inorg_N_Sim_ended : record.Inorg_N_Matured,
    Lt_N_cct: record.Litr_N_cc_termination,
    Lt_N_Sow: record.Litr_N_Sowing,
    Lt_N_LVg: record.Litr_N_Tasselinit,
    Lt_N_Slk: record.Litr_N_Silked,
    Lt_N_Res: record.Litr_N_Matured ? record.Litr_N_Sim_ended : record.Litr_N_Matured,
    ML_N_cct: record.Mul_N_cc_termination,
    ML_N_Sow: record.Mul_N_Sowing,
    ML_N_LVg: record.Mul_N_Tasselinit,
    ML_N_Slk: record.Mul_N_Silked,
    ML_N_Res: record.Mul_N_Matured ? record.Mul_N_Sim_ended : record.Mul_N_Matured,
    ML_M_cct: record.Mul_Mass_cc_termination,
    ML_M_Sow: record.Mul_Mass_Sowing,
    ML_M_LVg: record.Mul_Mass_Tasselinit,
    ML_M_Slk: record.Mul_Mass_Silked,
    ML_M_Res: record.Mul_Mass_Matured ? record.Mul_Mass_Sim_ended : record.Mul_Mass_Matured,
    MLCN_cct: record.Mul_CNR_cc_termination,
    MLCN_Sow: record.Mul_CNR_Sowing,
    MLCN_LVg: record.Mul_CNR_Tasselinit,
    MLCN_Slk: record.Mul_CNR_Silked,
    MLCN_Res: record.Mul_CNR_Matured ? record.Mul_CNR_Sim_ended : record.Mul_CNR_Matured,
    ID: record.ID,
  }));
  nitrogenOut = nitrogenOut.filter((record) => hasNonNullValues(record));

  // processing combined out
  // check full join used here - needs to be updated
  let combinedOut = fullJoin(cornOut, waterOut, ['ID'], ['ID']);
  combinedOut = fullJoin(combinedOut, nitrogenOut, ['ID'], ['ID']);
  combinedOut = fullJoin(combinedOut, stressOut, ['ID'], ['ID']);
  const filteredInput = modelInputData.map((record) => ({
    ID: record.ID,
    end_date: record.end_date,
  }));
  combinedOut = leftJoin(combinedOut, filteredInput, ['ID'], ['ID']);
  combinedOut = combinedOut.map((record) => ({
    modl_run: (
      record.dt_Mat
      || (record.end_date.getTime() - record.dt_SiEnd.getTime()) * 1000 * 60 * 60 * 24 < 10
    )
      ? 'good'
      : 'bad',
    ID: record.ID,
    lat: record.ID,
    long: record.ID,
    yield: record.yield,
    N_upt: record.N_upt,
    cum_ETsp: record.cum_ETsp,
    cum_Nlch: record.cum_Nlch,
    GDDSum: record.GDDSum,
    Rain_cum: record.Rain_cum,
    Infl_cum: record.Infl_cum,
    A_Ev_cum: record.A_Ev_cum,
    A_Tr_cum: record.A_Tr_cum,
    P_Ev_cum: record.P_Ev_cum,
    P_Tr_cum: record.P_Tr_cum,
    WSI_Veg: record.WSI_Veg,
    WSI_Rep: record.WSI_Rep,
    WSI_cum: record.WSI_cum,
    NSI_Veg: record.NSI_Veg,
    NSI_Rep: record.NSI_Rep,
    NSI_cum: record.NSI_cum,
    WSI_EVg: record.WSI_EVg,
    WSI_LVg: record.WSI_LVg,
    WSI_Slk: record.WSI_Slk,
    WSI_Gf: record.WSI_Gf,
    NSI_EVg: record.NSI_EVg,
    NSI_LVg: record.NSI_LVg,
    NSI_Slk: record.NSI_Slk,
    NSI_Gf: record.NSI_Gf,
    LAI: record.LAI,
    max_LAI: record.max_LAI,
    totalDM: record.totalDM,
    shootDM: record.shootDM,
    earDM: record.earDM,
    TotLfDM: record.TotLfDM,
    DrpLfDM: record.DrpLfDM,
    stemDM: record.stemDM,
    rootDM: record.rootDM,
    Rain_B4P: record.Rain_B4P,
    Rain_EVg: record.Rain_EVg,
    Rain_LVg: record.Rain_LVg,
    Rain_Slk: record.Rain_Slk,
    Rain_Gf: record.Rain_Gf,
    Rain_Veg: record.Rain_Veg,
    Rain_Rep: record.Rain_Rep,
    Infl_B4P: record.Infl_B4P,
    Infl_EVg: record.Infl_EVg,
    Infl_LVg: record.Infl_LVg,
    Infl_Slk: record.Infl_Slk,
    Infl_Gf: record.Infl_Gf,
    Infl_Veg: record.Infl_Veg,
    Infl_Rep: record.Infl_Rep,
    A_Ev_B4P: record.A_Ev_B4P,
    A_Ev_EVg: record.A_Ev_EVg,
    A_Ev_LVg: record.A_Ev_LVg,
    A_Ev_Slk: record.A_Ev_Slk,
    A_Ev_Gf: record.A_Ev_Gf,
    A_Ev_Veg: record.A_Ev_Veg,
    A_Ev_Rep: record.A_Ev_Rep,
    A_Tr_B4P: record.A_Tr_B4P,
    A_Tr_EVg: record.A_Tr_EVg,
    A_Tr_LVg: record.A_Tr_LVg,
    A_Tr_Slk: record.A_Tr_Slk,
    A_Tr_Gf: record.A_Tr_Gf,
    A_Tr_Veg: record.A_Tr_Veg,
    A_Tr_Rep: record.A_Tr_Rep,
    P_Ev_B4P: record.P_Ev_B4P,
    P_Ev_EVg: record.P_Ev_EVg,
    P_Ev_LVg: record.P_Ev_LVg,
    P_Ev_Slk: record.P_Ev_Slk,
    P_Ev_Gf: record.P_Ev_Gf,
    P_Ev_Veg: record.P_Ev_Veg,
    P_Ev_Rep: record.P_Ev_Rep,
    P_Tr_B4P: record.P_Tr_B4P,
    P_Tr_EVg: record.P_Tr_EVg,
    P_Tr_LVg: record.P_Tr_LVg,
    P_Tr_Slk: record.P_Tr_Slk,
    P_Tr_Gf: record.P_Tr_Gf,
    P_Tr_Veg: record.P_Tr_Veg,
    P_Tr_Rep: record.P_Tr_Rep,
    In_N_cct: record.In_N_cct,
    In_N_Sow: record.In_N_Sow,
    In_N_LVg: record.In_N_LVg,
    In_N_Slk: record.In_N_Slk,
    In_N_Res: record.In_N_Res,
    Lt_N_cct: record.Lt_N_cct,
    Lt_N_Sow: record.Lt_N_Sow,
    Lt_N_LVg: record.Lt_N_LVg,
    Lt_N_Slk: record.Lt_N_Slk,
    Lt_N_Res: record.Lt_N_Res,
    ML_N_cct: record.ML_N_cct,
    ML_N_Sow: record.ML_N_Sow,
    ML_N_LVg: record.ML_N_LVg,
    ML_N_Slk: record.ML_N_Slk,
    ML_N_Res: record.ML_N_Res,
    ML_M_cct: record.ML_M_cct,
    ML_M_Sow: record.ML_M_Sow,
    ML_M_LVg: record.ML_M_LVg,
    ML_M_Slk: record.ML_M_Slk,
    ML_M_Res: record.ML_M_Res,
    MLCN_cct: record.MLCN_cct,
    MLCN_Sow: record.MLCN_Sow,
    MLCN_LVg: record.MLCN_LVg,
    MLCN_Slk: record.MLCN_Slk,
    MLCN_Res: record.MLCN_Res,
    dt_cct: record.dt_cct,
    dt_Sow: record.dt_Sow,
    dt_Gmn: record.dt_Gmn,
    dt_Emg: record.dt_Emg,
    dt_Tsint: record.dt_Tsint,
    dt_Tsl: record.dt_Tsl,
    dt_Slk: record.dt_Slk,
    dt_Gf: record.dt_Gf,
    dt_Mat: record.dt_Mat,
    dt_SiEnd: record.dt_SiEnd,
    GO5_End: record.GO5_End,
    MsBl_End: record.MsBl_End,
  }));
  combinedOut.sort((a, b) => a.ID - b.ID);
  combinedOut = combinedOut.filter((record) => hasNonNullValues(record));

  console.log(
    'combined out: ',
    combinedOut,
  );
};
