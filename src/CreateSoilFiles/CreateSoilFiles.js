// will hopefully replace the C# and Fortran code of https://github.com/USDA-ARS-ACSL/CreateSoilFiles

console.time();

const fs = require('fs');

const readFile = (file, removeQuotes) => {
  let data = fs.readFileSync(file, 'utf8').trim();
  
  if (removeQuotes) {
    data = data.replace(/'/g, '');
  }
  
  data = data.split(/[\n\r]+/);

  data.forEach((row, i) => {
    data[i] = row.trim()
                .split(/\s+/)
                .map(e => Number.isFinite(+e) ? +e : e);
    data[i].org = row;
  });

  return data;
} // readFile

const arg = parm => {
  const pos = process.argv.indexOf(parm);
  if (pos > 0) {
    const result = process.argv[pos + 1];
    if (result[0] === '/') {
      error('next string after switch should be a string for the file name');
    }
    return result;
  }
}

const exit = (s => {
  console.log(s);
  process.exit();
});

const error = (s => {
  console.error(s);
  process.exit();
});

if (arg('/GN') && arg('/GM')) {
  error('Cannot use GM and GN together');
}

const GridFileRoot  = arg('/GN') || arg('/GM');
const SoilFile      = arg('/SN') ? arg('/SN') + '.dat' : '';

// This routine returns a vector of values (Segments)for the increments along a line from the starting point to the Length
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

// This routine returns a vector of values (Segments)for the increments along a line from the starting point to the Length
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

// emulate C# DataTable
const dataTable = (data, columns) => {
  data.forEach((row, i) => {
    data[i] = new Proxy(row, {
      get(target, key) {
        return key in target ? target[key] : target[columns.indexOf(key)];
      },
      set(target, key, value) {
        if (Number.isFinite(key)) target[key] = value;
        else target[columns.indexOf(key)] = value;
      }
    });
  });

  data.columns = columns;

  return data;
} // dataTable

const datagen2 = (layerFile) => {
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
    const dtNodal = dsGrid[0];
    const dtElem4Grid = dsGrid[1];

    // this selects a subset of the rows from the table where y=max(y)
    // in C#:  myRow = dtNodal.Select("Y=MAX(Y)");
    const maxY = Math.max(...dtNodal.map(e => e.Y));
    const myRow = dtNodal.filter(e => e.Y === maxY);

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

    WriteGridFile(dsGrid, 'run_01.grd', 'Grid_bnd', MatNum, BottomBC, GasBCTop, GasBCBottom);

    exit(dtNodal)
  };

  console.log(dtLayers);
} // datagen2

// This writes the grid file by taking items from the original file (template) and copying to the new file.
// The grid data with the new material numbers come from the datatable. 

const WriteGridFile = (dsGrid, NewGridFile, OldGridFile, MatNum, BottomBC, GasBCTop, GasBCBottom) => {
  const OutNode = dsGrid[0];
  const OutElem = dsGrid[1];
  const data = readFile(OldGridFile);
  const s = [];
  
  let i = 0;
  s.push(data[i++].org);
  s.push(data[i++].org);
  s.push(data[i++].org);
  s.push(data[i++].org);


  OutNode.forEach(row => {
    s.push(`\t${row.join('\t')}`);
    i++;
  });

  s.push(data[i++].org);
  s.push(data[i++].org);

  OutElem.forEach(row => {
    s.push(`\t${row.join('\t')}`);
  });

  // s.push(...data.slice(6));
  fs.writeFileSync(NewGridFile, s.join('\n'));
} // WriteGridFile

// This procedure reads the Grid file and extracts the grid 
// the procedure creates a table to hold the grid data and fills it with data from the file.
const ParseGridFile = (GridFile) => {
  const data = readFile(GridFile);
  const [_, node, element] = data[2];

  const dtNode = dataTable(data.slice(4, node + 4), [
    'Node',
    'X',
    'Y',
    'MatNum',
    'NodeArea',
    'RTWT0',
    'RTWT1',
    'RTWT'
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

const WriteNodalFile = (NodalFileName, dtNodal) => {
  const s = [' ***************** NODAL INFORMATION for MAIZSIM *******************************************************'];
  s.push(`\t${dtNodal.columns.join('\t')}`)
  dtNodal.forEach(Row => {
    s.push(Row.map(col => col === 'Node' ? `\t${Row[col]}` :
                          col === 'RTWT' ? `\t${Row[col].toFixed(6)}` :
                                           `\t${Row[col].toFixed(2)}`
    ));
  });
  fs.writeFileSync(NodalFileName, s.join('\n'));
} // WriteNodalFile

const CreateNodalTable = (dtGrid) => {
  const dtNodal = dataTable(dtGrid, [
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

//  int nodes = dtGrid.Rows.Count;
//  // create a table with zeroes as elements. Table has same number of rows as the grid table
//  for (i = 0; i < nodes; i++)
//  {
//      dr = dtNodal.NewRow();
//      dr[0]=i+1;
//      for (j=1;j<dtNodal.Columns.Count;j++)
//      {
//          dr[j]=0;
//      }
//      DataRow r=dtGrid.Rows[i];
//      dr["RTWT"] = r["RTWT"];
//      dr["MatNum"]=r["MatNum"];
//      dr["Y"] = r["Y"];
//      dtNodal.Rows.Add(dr);
//  }
  return dtNodal;
} // CreateNodalTable

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
  fs.writeFileSync('datagen2.dat', s.join('\n'));  
} // WriteToGridGenFile

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

  const data = readFile('datagen2.dat');

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

  fs.writeFileSync('grid_bnd', s.join('\n'));
} // grid_bnd

datagen2(process.argv[2]);

console.timeEnd();