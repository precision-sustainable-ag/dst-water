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

export const geospatialProcessing = (fileDir, init, ccTerminationDate) => {
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
  ccTerminationDate.map((cc) => {
    if (!checkDuplicateJson(uniqueTerminationDate, cc)) {
      uniqueTerminationDate.push(cc);
    }
    return 0;
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
  fileDir.forEach(async (inputFile) => {
    if (inputFile.subfolder === 'MDC410_C_2008') {
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
        crop_Stage: record.crop_stage,
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
      console.log('data: ', allMassBlData);
    }
  });
};
