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

  // going through each input folder
  let modelOut = [];
  fileDir.forEach(async (inputFile) => {
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
    allPlantDataG01 = allPlantDataG01.reduce((acc, record) => {
      const key = record.crop_stage;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(record);
      return acc;
    }, []);
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
      allOut.forEach((recordAllOut) => {
        sampleModelInputData.forEach((recordSample) => {
          if (
            recordSample.ID === recordAllOut.ID
            && recordSample.crop_stage === recordAllOut.crop_stage
            && recordSample.Date.getTime() === recordAllOut.Date.getTime()
          ) {
            recordSample.existing = true;
          }
        });
      });
      sampleModelInputData.forEach((record) => {
        if (!record.existing) {
          const newObj = {};
          Object.keys(allOut[0]).forEach((k) => {
            newObj[k] = record[k] || null;
          });
          allOut.push(newObj);
        }
      });
      allOut.sort((a, b) => a.Date - b.Date);
      const allOutAtmosKeys = Array.from(new Set(
        Object.keys(allOut[0]).concat(
          Object.keys(allAtmosDataG05[0]),
        ),
      ));
      const allOutJoin1 = [];
      allOut.forEach((recordOut) => {
        let match = false;
        allAtmosDataG05.forEach((recordAtmos) => {
          if (
            recordOut.ID === recordAtmos.ID
            && recordOut.Date.getTime() === recordAtmos.Date.getTime()
          ) {
            match = true;
            const newObj = {};
            allOutAtmosKeys.forEach((key) => {
              newObj[key] = recordOut[key] || recordAtmos[key] || null;
            });
            allOutJoin1.push(newObj);
          }
        });
        if (!match) {
          const newObj = {};
          allOutAtmosKeys.forEach((key) => {
            newObj[key] = recordOut[key] || null;
          });
          allOutJoin1.push(newObj);
        }
      });
      const allOutJoin1MassBlKeys = Array.from(new Set(
        Object.keys(allOutJoin1[0]).concat(
          Object.keys(allMassBlData[0]),
        ),
      ));
      const allOutJoin2 = [];
      allOutJoin1.forEach((recordOut) => {
        let match = false;
        allMassBlData.forEach((recordMass) => {
          if (
            recordOut.ID === recordMass.ID
            && recordOut.Date.getTime() === recordMass.Date.getTime()
          ) {
            match = true;
            const newObj = {};
            allOutJoin1MassBlKeys.forEach((key) => {
              newObj[key] = recordOut[key] || recordMass[key] || null;
            });
            allOutJoin2.push(newObj);
          }
        });
        if (!match) {
          const newObj = {};
          allOutJoin1MassBlKeys.forEach((key) => {
            newObj[key] = recordOut[key] || null;
          });
          allOutJoin2.push(newObj);
        }
      });
      const endAtmosG05 = allAtmosDataG05.filter((record) => record.G05_End === 'G05_End');
      allOutJoin2.forEach((recordAllOut) => {
        endAtmosG05.forEach((recordEndAtmos) => {
          if (
            recordEndAtmos.ID === recordAllOut.ID
            && recordEndAtmos.Date.getTime() === recordAllOut.Date.getTime()
            && recordEndAtmos.SeasPSoEv === recordAllOut.SeasPSoEv
            && recordEndAtmos.SeasASoEv === recordAllOut.SeasASoEv
            && recordEndAtmos.SeasPTran === recordAllOut.SeasPTran
            && recordEndAtmos.SeasATran === recordAllOut.SeasATran
            && recordEndAtmos.SeasRain === recordAllOut.SeasRain
            && recordEndAtmos.SeasInfil === recordAllOut.SeasInfil
            && recordEndAtmos.G05_End === recordAllOut.G05_End
          ) {
            recordEndAtmos.existing = true;
          }
        });
      });
      endAtmosG05.forEach((record) => {
        if (!record.existing) {
          const newObj = {};
          Object.keys(allOut[0]).forEach((k) => {
            newObj[k] = record[k] || null;
          });
          allOutJoin2.push(newObj);
        }
      });
      allOut = allOutJoin2.map((record) => ({
        ...record,
        crop_stage: !record.crop_stage || ['NA', ''].includes(record.crop_stage) ? record.G05_End : record.crop_stage,
      }));
      const fillColumnsAtmos = ['SeasPSoEv', 'SeasASoEv', 'SeasPTran', 'SeasATran', 'SeasRain', 'SeasInfil'];
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
        endMassBl.forEach((recordEndMass) => {
          if (
            recordEndMass.ID === recordAllOut.ID
            && recordEndMass.Date.getTime() === recordAllOut.Date.getTime()
            && recordEndMass.Inorg_N === recordAllOut.Inorg_N
            && recordEndMass.Litr_N === recordAllOut.Litr_N
            && recordEndMass.Mul_N === recordAllOut.Mul_N
            && recordEndMass.NO3_lch === recordAllOut.NO3_lch
            && recordEndMass.Mul_Mass === recordAllOut.Mul_Mass
            && recordEndMass.Mul_CNR === recordAllOut.Mul_CNR
            && recordEndMass.MsBl_End === recordAllOut.MsBl_End
          ) {
            recordEndMass.existing = true;
          }
        });
      });
      endMassBl.forEach((record) => {
        if (!record.existing) {
          const newObj = {};
          Object.keys(allOut[0]).forEach((k) => {
            newObj[k] = record[k] || null;
          });
          allOut.push(newObj);
        }
      });
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
  });
};
