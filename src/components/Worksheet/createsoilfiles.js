/* eslint-disable no-console */
/* eslint-disable camelcase */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-plusplus */
/* eslint-disable max-len */
/* eslint-disable no-alert */
import { dataTable } from './utilities';
import { rosetta } from '../../store/Store';

const site = 'run_01'; // TODO
const soilFile = 'meadir_run_01.dat'; // TODO

// ____________________________________________________________________________________________________________________________________
const createSoilFiles = (files) => {
  const fs = { // TODO
    writeFileSync: (path, s) => {
      console.log(path);
      files[path] = s;
    },
  };

  const readFile = (path, removeQuotes) => {
    let data = files[path].trim();
    if (!data) {
      alert(path);
    }

    if (removeQuotes) {
      data = data.replace(/'/g, '');
    }

    data = data.split(/[\n\r]+/);

    data.forEach((row, i) => {
      data[i] = row.trim()
        .split(/\s+/)
        .map((e) => (Number.isFinite(+e) ? +e : e));
      data[i].org = row;
    });

    return data;
  }; // readFile

  // ____________________________________________________________________________________________________________________________________
  // writes the file with input data for rosetta
  const CreateSoilFile = (dtLayer, SoilFileName) => {
    const s = [];
    s.push('  Matnum      sand     silt    clay     bd     om   TH33       TH1500 ');
    let matnum = 1;
    dtLayer.forEach((row) => {
      s.push(` ${matnum}\t ${row.Sand.toFixed(3)}\t ${row.Silt.toFixed(3)}\t ${row.Clay.toFixed(3)}\t ${row.BD.toFixed(3)}\t ${row.OM.toFixed(3)}\t ${row.TH33.toFixed(3)}\t  ${row.TH1500.toFixed(3)}\t '${row.InitType}'`);
      matnum++;
    });
    s.push('');

    fs.writeFileSync(SoilFileName, s.join('\n'));
  }; // CreateSoilFile

  // ____________________________________________________________________________________________________________________________________
  // Returns a vector of values (Segments)for the increments along a line from the starting point to the Length
  // The first column is node, the second is the Y value.
  // This method uses a geometric progression where IntervalRatio is the ratio between two depths
  // direction is 1 for up to down and -1 for down to up
  // Returns ArrayList Segments
  const CaclYNodes = (IntervalRatio, Length, StartPoint, FirstInterval, Direction) => {
    let CalculatedLength = FirstInterval; // keeps track of the summed length of the segments to compare with the planned length (Length)
    const Segment = [];
    let dNumberOfNodes = 1 - (Length / FirstInterval) * (1 - IntervalRatio);
    dNumberOfNodes = Math.log(dNumberOfNodes) / Math.log(IntervalRatio) + 1;
    const NumberOfNodes = Math.round(dNumberOfNodes);

    Segment.push(StartPoint);
    Segment.push(StartPoint - FirstInterval * Direction); // those going down will decrease in value
    // those going up increase; in value
    let aux1 = FirstInterval;
    // start at the 3rd node (i=2)
    for (let i = 2; i < NumberOfNodes; i++) {
      if (Direction === 1) {
        aux1 += FirstInterval * IntervalRatio ** (i - 1);
        let Distance = StartPoint - aux1;
        CalculatedLength += FirstInterval * IntervalRatio ** (i - 1);
        const Difference = CalculatedLength - Length;
        // if we overshot or undershot the distance we have to correct the last length
        if (i === NumberOfNodes - 1) {
          if (Math.abs(Difference) > 0) {
            Distance += Difference;
          }
        }

        Segment.push(Distance); // if you round up on number of nodes. you will go past the length.
        // This can be calculated as (dNumberOfNodes-NumberOfNodes)
      } else if (Direction === -1) {
        aux1 += FirstInterval * IntervalRatio ** (i - 1);
        let Distance = StartPoint + aux1;
        CalculatedLength += FirstInterval * IntervalRatio ** (i - 1);
        const Difference = CalculatedLength - Length;

        if (i === NumberOfNodes - 1) {
          if (Math.abs(Difference) > 0) {
            Distance -= Difference;
          }
        }
        Segment.push(Distance);
      }
    }
    return Segment.map((e) => +(e.toFixed(5)));
  }; // CaclYNodes

  // ____________________________________________________________________________________________________________________________________
  // Returns a vector of values (Segments)for the increments along a line from the starting point to the Length
  // The first column is node, the second is the Y value.
  // This method uses a geometric progression where IntervalRatio is the ratio between two depths
  // Calculates the nodes for the X dimension (across row). The only input it RowSpacing
  // parameters for interval, etc are hardcoded.
  // Returns ArrayList Segments
  const CaclXNodes = (RowSpacing) => {
    const FirstInterval = 0.75;
    const IntervalRatio = 1.4; // WSun change the values to make the number of nodes in X direction become 7
    const Length = RowSpacing / 2;
    const StartPoint = 0;
    const Segment = [];

    let dNumberOfNodes = 1 - (Length / FirstInterval) * (1 - IntervalRatio);
    dNumberOfNodes = Math.log(dNumberOfNodes) / Math.log(IntervalRatio) + 1;
    const NumberOfNodes = Math.round(dNumberOfNodes);

    let CalculatedLength = FirstInterval;
    Segment.push(StartPoint, StartPoint + FirstInterval); // x axis increases in value
    let aux1 = FirstInterval;
    // start at the 3rd node (i=2)
    for (let i = 2; i < NumberOfNodes; i++) {
      aux1 += FirstInterval * IntervalRatio ** (i - 1);
      let Distance = StartPoint + aux1;
      CalculatedLength += FirstInterval * IntervalRatio ** (i - 1);
      const Difference = Length - CalculatedLength;
      // if we overshot or undershot the distance we have to correct the last length
      if (i === NumberOfNodes - 1) {
        if (Difference < 0) {
          Distance += Difference;
        }
        if (Math.abs(Difference) > 0) {
          Distance = Length;
        }
      }

      Segment.push(Distance); // if you round up on number of nodes. you will go past the length.
      // This can be calculated as (dNumberOfNodes-NumberOfNodes)
    }
    return Segment;
  }; // CaclXNodes
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
    dtGrid.forEach((Dr) => {
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

    dtNode.forEach((Dr) => {
      const { Node } = Dr;
      const x = Dr.X;
      const y = ProfileDepth - Dr.Y;
      Dr.RTWT0 = 0;
      Dr.NodeArea = NodeArea[Node];

      if (y <= PlantingDepth * 2.0 && x <= xRootExtent) {
        const root2 = (1.0 / (4 * time)) * (x * (x / difx) + (y * y) / dify);

        const root1 = M / (4.0 * 3.1415 * time * Math.sqrt(difx * dify));

        Dr.RTWT0 = root1 * Math.exp(-root2); // need to drop the row at the end?
        // RTWT = Dr["RTWT"];
      }
      Dr.RTWT1 = (dtNode[Node - 1].NodeArea) * (dtNode[Node - 1].RTWT0); // WSun RTWT1 represents the multiplication of RTWT0 and node area
      TotalRTWT += Dr.RTWT1;// WSun TotalRTWT represents the sum of RTWT1
    });

    // Find nodes and associated elements.

    // then find the center of the node to get a distance
    // can get node numbers for elements from dtElement and x,y from dt Node
    // calc roots as per x and y
    // first find centers of the elements where x< 20 and y< 20,
    // calculate roots at these xs and ys

    // WSun Calculation the root density (RTWT) which read by SPUDSIM
    const rootweightperslab1 = (rootweightperslab / TotalRTWT); // WSun  rootweightperslab1 represents the division of root weight per slab and Total RTWT

    // dtNode.Columns.Add(new DataColumn("RTWT", typeof(double))); // WSun RTWT represents the root density which read by SPUDSIM
    dtNode.forEach((Dr) => {
      const { Node } = Dr;
      Dr.RTWT = (dtNode[Node - 1].RTWT0) * rootweightperslab1;
    });

    return dtNode;
  }; // CalculateRoot

  // ____________________________________________________________________________________________________________________________________
  // Writes the grid file by taking items from the original file (template) and copying to the new file.
  // The grid data with the new material numbers come from the datatable.
  const WriteGridFile = (dsGrid, NewGridFile, OldGridFile, MatNum) => {
    const OutNode = dsGrid[0];
    const OutElem = dsGrid[1];
    const data = readFile(OldGridFile);
    const s = [];

    let i = 0;
    s.push(data[i++].org);
    s.push(data[i++].org);
    data[i][5] = MatNum;
    s.push(`  ${data[i++].join('     ')}  `);
    s.push(data[i++].org);

    OutNode.forEach((row) => {
      s.push(`\t${row.join('\t')}`);
      i++;
    });

    s.push(data[i++].org);
    s.push(data[i++].org);

    OutElem.forEach((row) => {
      s.push(`\t${row.join('\t')}`);
      i++;
    });

    s.push(...data.slice(i).map((row) => row.org));
    fs.writeFileSync(NewGridFile, s.join('\n'));
  }; // WriteGridFile

  // ____________________________________________________________________________________________________________________________________
  // Reads the Grid file and extracts the grid.
  // Creates a table to hold the grid data and fills it with data from the file.
  const ParseGridFile = (GridFile) => {
    const data = readFile(GridFile);
    // eslint-disable-next-line no-unused-vars
    const [_, node, element] = data[2];

    const dtNode = dataTable(data.slice(4, node + 4), [
      'Node',
      'X',
      'Y',
      'MatNum',
      'NodeArea',
      'RTWT0', // WSun RTWT0 represents relative number of root density (no relationship with any physical)
      'RTWT1', // WSun RTWT1 represents the multiplication of RTWT0 and node area
      'RTWT', // WSun RTWT represents the root density which read by SPUDSIM
    ]);

    const dtElem4Grid = dataTable(data.slice(node + 6, element + node + 6), [
      'Element',
      'TL',
      'BL',
      'BR',
      'TR',
      'MatNum',
    ]);

    return [dtNode, dtElem4Grid];
  }; // ParseGridFile

  // ____________________________________________________________________________________________________________________________________
  const WriteNodalFile = (NodalFileName, dtNodal) => {
    const s = [' ***************** NODAL INFORMATION for MAIZSIM *******************************************************'];
    s.push(`\t${dtNodal.columns.join('\t')}`);
    dtNodal.forEach((Row) => {
      s.push(
        `\t${
          Row.map((col, i) => (dtNodal.columns[i] === 'Node' ? `${col}`
            : dtNodal.columns[i] === 'RTWT' ? `${col.toFixed(6)}`
              : `${col.toFixed(2)}`)).join('\t')}`,
      );
    });
    fs.writeFileSync(NodalFileName, s.join('\n'));
  }; // WriteNodalFile

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
      'Y',
    ]);

    dtGrid.forEach((row, i) => {
      dtNodal[i].Node = i + 1;
      dtNodal[i].RTWT = row.RTWT;
      dtNodal[i].MatNum = row.MatNum;
      dtNodal[i].Y = row.Y;
    });

    return dtNodal;
  }; // CreateNodalTable

  // ____________________________________________________________________________________________________________________________________
  // Writes to the GridGenFile which is used by the fortran program
  const WriteToGridGenFile = (GridGenInput, YSegment, xSegment, BottomBC, GasBCTop, GasBCBottom) => {
    const s = ['IJ  E00  n00   NumNP  NumEl NMAt  BC  GasBCTop   GasBCBottom'];

    // calculate total number of y nodes
    let YnodeCount = 0;
    YSegment.forEach((Seg) => { YnodeCount += Seg.length; });

    s.push(` ${xSegment.length} 1   1  ${xSegment.length * YnodeCount}   ${(xSegment.length - 1) * (YnodeCount - 1)}  0  ${BottomBC}   ${GasBCTop}   ${GasBCBottom}`);
    s.push('x(j): ');

    s.push(` ${xSegment.join('  ')} `);
    s.push('y(i): 1->(NumNP-n00)/IJ+1');

    YSegment.forEach((Seg) => s.push(` ${Seg.join('  ')} `));
    fs.writeFileSync('datagen2.dat', s.join('\n'));
  }; // WriteToGridGenFile

  // ____________________________________________________________________________________________________________________________________
  const grid_bnd = () => {
    const format = (parms, formats) => {
      let row = '';
      formats.split(',').map((s) => s.trim()).forEach((fmt) => {
        if (/\d+x/i.test(fmt)) {
          row += ' '.repeat(parseInt(fmt, 10));
        } else if (/\d*i\d/i.test(fmt)) {
          if (fmt[0] === 'i') {
            fmt = `1${fmt}`;
          }
          const [n, w] = fmt.match(/\d+/g);

          for (let i = 0; i < n; i++) {
            row += (parms.shift().toString() || '0').padStart(w);
          }
        } else if (/\d*f\d*/i.test(fmt)) {
          if (fmt[0] === 'f') {
            fmt = `1${fmt}`;
          }
          const [n, w, d] = fmt.match(/\d+/g);
          for (let i = 0; i < n; i++) {
            row += (+(parms.shift() || 0)).toFixed(+d).padStart(+w);
          }
        } else if (fmt[0] === '\'') {
          row += fmt.replace(/'/g, '');
        } else {
          console.error('UNKNOWN FORMAT:', fmt);
          process.exit();
        }
      });

      // eslint-disable-next-line no-use-before-define
      s.push(row);
    }; // format

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
    format([NumNP, NumEl, NumBP, IJ, NMat], '2x,\'2\',3i8,2i7');
    output('   n           x          y      MatNum');

    const XX = [];
    const YY = [];

    for (let i = 1; i <= Numlin; i++) {
      for (let j = 1; j <= IJ; j++) {
        const n = n00 + (i - 1) * IJ + j - 1;
        const xN = x[j];
        const yN = y[i];
        const MatNum1 = MatNum[i];
        format([n, xN, yN, MatNum1], 'i5,2f12.2,i8');
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

    output('****************Boundary geometry information**************************************');
    output('    n  CodeW  CodeC  CodeH  CodeG  Width');

    for (let k = 1; k <= 2; k++) {
      for (let j = 1; j <= IJ; j++) {
        const k2 = Math.min(IJ, j + 1);
        const k1 = Math.max(1, j - 1);
        const Width = (x[k2] - x[k1]) / 2;

        if (k === 1) {
          format([j, GasBCTop, Width], 'i5,\' -4    0     -4 \', i5, f10.2');
        } else {
          format([IJ * (Numlin - 1) + j, BC, GasBCBot, Width], 'i5, i5, \'   0       1     \', i5,f10.2');
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
  }; // grid_bnd

  const data = readFile('run_01.lyr', true);

  const [SurfaceIntervalRatio, FirstSurfaceInterval, InternalIntervalRatio, FirstInternalInterval] = data[1];
  const [RowSpacing] = data[3];
  const [PlantingDepth, xRootExtent, rootweightperslab] = data[5];
  const [BottomBC, GasBCTop, GasBCBottom] = data[8];
  console.log({
    SurfaceIntervalRatio, FirstSurfaceInterval, InternalIntervalRatio, FirstInternalInterval, RowSpacing, PlantingDepth, xRootExtent, rootweightperslab, BottomBC, GasBCTop, GasBCBottom,
  });

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
    'Y_Mid',
  ]);

  const MatNum = dtLayers.length;
  const ProfileDepth = dtLayers[MatNum - 1][0];

  // Now calculate midpoint depths in interior layers for use in interpolation later
  // Also calculate Nitrogen and Carbon concentrations from litter and OM additions
  // don't have litter and manure yet but will have it in the future

  dtLayers[0].Y = ProfileDepth - dtLayers[0].Depth;
  dtLayers[0].Y_Mid = ProfileDepth;
  dtLayers[MatNum - 1].Y = ProfileDepth - dtLayers[MatNum - 1].Depth;
  dtLayers[MatNum - 1].Y_Mid = dtLayers[MatNum - 1].Y;

  for (let i = 1; i < MatNum - 1; i++) {
    dtLayers[i].Y = ProfileDepth - dtLayers[i].Depth;
    dtLayers[i].Y_Mid = (dtLayers[i - 1].Y - dtLayers[i].Y) / 2.0;
    dtLayers[i].Y_Mid += dtLayers[i].Y;
  }

  // Now calculate slopes of changes in properties from layer to layer so we can interpolate
  // If we add columns after OM then we have to increase the counter in dtLayers.Rows[i + 1][j - 21]. j-21 should begin
  // I think this should be the total number of columns minus the number of columns before OM
  // with column 2 if we add anything after OM. if you add a column before OM then decrease this number

  for (let i = 0; i < MatNum - 1; i++) {
    // slopes begin after column thk; last two columns are y and y_mid values
    for (let j = dtLayers.columns.indexOf('thk') + 1; j < dtLayers.columns.length - 2; j++) {
      // calculate slopes needed to interpolate soil properties through the profile
      dtLayers[i][j] = (dtLayers[i + 1][j - 22] - dtLayers[i][j - 22]) / (dtLayers[i + 1].Y_Mid - dtLayers[i].Y_Mid);
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
      dtLayers.slice(1).forEach((lyr) => {
        const upr = lower;
        lower = ProfileDepth - lyr[0]; // the first item in the layer string is the depth
        const middle = (upr - lower) / 2.0;
        const SegmentOne = CaclYNodes(InternalIntervalRatio, middle, upr, FirstInternalInterval, 1).slice(0, -1);
        const SegmentTwo = CaclYNodes(SurfaceIntervalRatio, middle, lower, FirstInternalInterval, -1).sort((a, b) => b - a).slice(0, -1);
        MasterSegment.push(SegmentOne, SegmentTwo);
      });
    }

    const xSegment = CaclXNodes(RowSpacing);

    WriteToGridGenFile('dataGen2.dat', MasterSegment, xSegment, BottomBC, GasBCTop, GasBCBottom);
    grid_bnd();

    const dsGrid = ParseGridFile('grid_bnd');
    let dtNodal = dsGrid[0];
    const dtElem4Grid = dsGrid[1];

    // this selects a subset of the rows from the table where y=max(y)
    // in C#:  myRow = dtNodal.Select("Y=MAX(Y)");
    const maxY = Math.max(...dtNodal.map((e) => e.Y));
    let myRow = dtNodal.filter((e) => e.Y === maxY);

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
      const myRows = dtNodal.filter(expression);

      // standard method to loop within a DataTable
      myRows.forEach((Row) => { Row.MatNum = i + 1; });
    });

    dtElem4Grid.forEach((Row) => {
      const NodeBL = Row.BL;
      const theRow = dtNodal.filter((row) => row.Node === NodeBL);
      // eslint-disable-next-line prefer-destructuring
      Row.MatNum = theRow[0][3];
    });

    WriteGridFile(dsGrid, `${GridFileRoot}.grd`, 'grid_bnd', MatNum, BottomBC, GasBCTop, GasBCBottom);

    const dtGrid = dsGrid[0];
    // Now get Nodal Data. Need node numbers from grid table and other information from layer file

    CalculateRoot(dsGrid[0], dtElem4Grid, ProfileDepth, PlantingDepth, xRootExtent, rootweightperslab); // WSun call root density and add a new column in nodal file

    dtNodal = CreateNodalTable(dtGrid);

    // Now add layer information to the nodal table
    // If we have only one layer there is no need to interpolate big error here, this code will never execute!!, Matnum is not likely to be one
    // if (MatNum == 1)
    // select MatNum==1

    myRow = dtNodal.filter((row) => row.MatNum === 1);

    const PERCENT_C = 0.58;
    const PERCENT_N = 0.05;
    myRow.forEach((row) => {
      // calculate Nh and Ch here. Need OM and BD.
      row.NO3 = dtLayers[0].NO3; // initially it is ppm or g NO3 per 1,000,000 grams of soil (ug/g)
      row.Tmpr = dtLayers[0].Tmpr;
      row.CO2 = dtLayers[0].CO2;
      row.O2 = dtLayers[0].O2;
      row.hNew = dtLayers[0].hNew;
      row.NH4 = dtLayers[0].NH4;
      const TempCalc = dtLayers[0].BD * 1.0e6 // gives ug per cm3
                       * dtLayers[0].OM; // gives ug OM cm3
      row.Ch = TempCalc * PERCENT_C; // gives ug organic C per cm3 soil
      row.Nh = TempCalc * PERCENT_N; // gives ug organic N per cm3 soil
    });

    dtLayers.forEach((row, i) => {
      // we have only two regression equations for two or more intervals. I'm not sure if this will work for one or two layers
      // may have to have dummy layers for that case

      let expression;
      if (i === MatNum - 2) {
        // in the last case we need to catch the bottom of the last layer as well.
        // This will be filtered out if Y> is used
        expression = (r) => r.Y <= dtLayers[i].Y_Mid && r.Y >= dtLayers[i + 1].Y_Mid;
      } else {
        expression = (r) => r.Y <= dtLayers[i].Y_Mid && r.Y > dtLayers[i + 1].Y_Mid;
      }

      const myRows = dtNodal.filter(expression);

      myRows.forEach((r) => {
        const dy = r.Y - dtLayers[i].Y_Mid;
        // calculate Nh and Ch here. Need OM and BD.
        r.NO3 = dtLayers[i].NO3 + dtLayers[i].NO3_Slope * dy;
        r.Tmpr = dtLayers[i].Tmpr + dtLayers[i].Tmpr_Slope * dy;
        r.CO2 = dtLayers[i].CO2 + dtLayers[i].CO2_Slope * dy;
        r.O2 = dtLayers[i].O2 + dtLayers[i].O2_Slope * dy;
        r.NH4 = dtLayers[i].NH4 + dtLayers[i].NH4_Slope * dy;
        const TempCalc = (dtLayers[i].BD + dtLayers[i].BD_Slope * dy) * 1.0e6
                         * (dtLayers[i].OM + dtLayers[i].OM_Slope * dy);
        r.Ch = TempCalc * PERCENT_C;
        r.Nh = TempCalc * PERCENT_N;
      });

      dtLayers.forEach((rowLine, ix) => {
        // we use MatNum here to select corresponding rows from each table
        const myRowL = dtNodal.filter((r) => r.MatNum === ix + 1);
        myRowL.forEach((mrow) => {
          mrow.hNew = rowLine.hNew;
        });
      });
    });

    // drop MatNum column since it is not part of the Nodal file
    dtNodal.remove('MatNum');
    dtNodal.remove('Y');

    // Now write out the nodal and element data
    WriteNodalFile(`${GridFileRoot}.nod`, dtNodal, dtLayers);

    const SoilFile = soilFile.replace('.soi', '.dat'); // arg('/SN') ? arg('/SN') + '.dat' : '';
    CreateSoilFile(dtLayers, SoilFile);

    console.time('Rosetta time');
    const soildata = readFile(SoilFile).slice(1);

    rosetta(soildata);
  }
}; // createSoilFiles

export default createSoilFiles;
