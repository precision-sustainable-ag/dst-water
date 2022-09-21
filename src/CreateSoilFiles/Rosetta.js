const {readFile, dataTable, exit, error} = require('./utilities');

const {txt_rosetta, tsssc, tssscbd, tssscbdth33, tssscbdth3315, twssc, twsscbd, twsscbdth33, twsscbdth3315, newunsk, ANN_MODEL} = require('./RosettaConstants');

const MINBD = 0.5;
const MAXBD = 2.0;
const MINGRAVEL = 0.0;
const MAXGRAVEL = 100.0;
const MINSUM = 99;
const MAXSUM = 101;
const MINOC = 0.0;
const MAXOC = 100.0;
const MINTH33 = 0.0;
const MAXTH33 = 1.0;
const MINTH15 = 0.0;
const MAXTH15 = 1.0;
const MISSING = -9.9;
const NDES = 129;

const SSC_INVALID = 1;
const BD_INVALID = 2;
const TH33_INVALID = 4;
const TH1500_INVALID = 8;
const VG4_INVALID = 16;
const MODEL_INVALID = 32;

const TXT_CLAY = 0;
const TXT_CLAYLOAM = 1;
const TXT_LOAM = 2;
const TXT_LOAMYSAND = 3;
const TXT_SAND = 4;
const TXT_SANDYCLAY = 5;
const TXT_SANDYCLAYLOAM = 6;
const TXT_SANDYLOAM = 7;
const TXT_SILT = 8;
const TXT_SILTYCLAY = 9;
const TXT_SILTYCLAYLOAM = 10;
const TXT_SILTYLOAM = 11;
const TXT_UNKNOWN = 1;
const TINY = 0.01;
const MIN_TXT_SUM =	99.0;
const MAX_TXT_SUM =	101.0;

const is_valid_ssc = ({sand, silt, clay}) => {
  if (sand < 0.0 || sand > 101.0) return false;
  if (silt < 0.0 || silt > 101.0) return false;
  if (clay < 0.0 || clay > 101.0) return false;
  const sum = sand + clay + silt;
  if (sum > MAXSUM || sum < MINSUM) return false;
  return true;
} // is_valid_ssc

const is_valid_bd = ({bd}) => {
  return bd >= MINBD && bd <= MAXBD;
} // is_valid_bd

const is_valid_th33 = ({th33}) => {
  return th33 >= MINTH33 && th33 <= MAXTH33;
} // is_valid_th33

const is_valid_th1500 = ({th1500, th33}) => {
  return th1500 >= MINTH15 && th1500 <= MAXTH15 && th1500 <= th33;
} // is_valid_th1500

const is_valid_gravel = ({gravel}) => {
  return gravel >= MINGRAVEL && gravel <= MAXGRAVEL;
} // is_valid_gravel

const is_valid_VG4 = ({vgthr, vgths, vgalp, vgnpar}) => {
  // the hydraulic parameters should be linear, i.e. not scaled or log values.
  if (vgthr < 0.0) return 0;
  if (vgthr > 1.0) return 0;
  if (vgths < 0.0) return 0;
  if (vgths > 1.0) return 0;
  if (vgths < vgthr) return 0;
  if (vgalp < 0) return 0;
  if (vgalp > 1) return 0;
  if (vgnpar <= 1.0) return 0;
  // this will screw up people with very high n values.......
  if (vgnpar > 10.0) return 0;
  else return 1;
} // is_valid_VG4

const is_clay = (sand, clay) => {
  return clay >= 40.0 - TINY &&
	       sand < 45.0 &&
	       100.0 -sand - clay < 40 &&
         sand >= 0.0 &&
         clay >= 0.0;
} // is_clay

const is_siltyclay = (sand, clay) => {
  return clay >= 40.0 - TINY &&
	       100.0 - sand - clay >= 40.0 - TINY &&
         sand >= 0.0 &&
         clay >= 0.0;
} // is_siltyclay

const is_siltyclayloam = (sand, clay) => {
  return clay >= 28 - TINY &&
	       sand < 20.0 &&
	       clay < 40.0 &&
         sand >= 0.0 &&
         clay >= 0.0;
} // is_siltyclayloam

const is_clayloam = (sand, clay) => {
  return clay >= 27.0 - TINY &&
	       clay < 40 &&
	       sand >= 20.0 - TINY &&
	       sand <45 &&
         sand >= 0.0 &&
         clay >=0.0;
} // is_clayloam

const is_loam = (sand, clay) => {
  return clay < 27.0 &&
	       clay >= 7 - TINY &&
	       sand < 52.0 &&
	       100 - sand - clay >= 28 - TINY &&
	       100 - sand - clay < 50 &&
         sand >= 0.0 &&
         clay >= 0.0;
} // is_loam

const is_siltyloam = (sand, clay) => {
  return 100 - sand - clay >= 50.0 - TINY &&
	       clay < 28 &&
	       !is_silt(sand, clay) &&
         sand + clay > 0.0;
} // is_siltyloam

const is_silt = (sand, clay) => {
  return 100 - sand - clay >= 80.0 - TINY &&
	       clay < 12 &&
	       sand >= 0.0 &&
	       sand + clay != 0.0 &&
	       clay >= 0.0;
} // is_silt

const is_sandyclay = (sand, clay) => {
  return clay >= 35.0 - TINY &&
         sand >= 45 - TINY &&
         sand >= 0.0 &&
         clay >= 0.0;
} // is_sandyclay

const is_sandyclayloam = (sand, clay) => {
  return clay < 35.0 &&
         clay >= 20 - TINY &&
         sand >= 45 - TINY &&
         100 - sand - clay < 28 &&
         sand >= 0.0 &&
         clay >= 0.0;
} // is_sandyclayloam

const is_sandyloam = (sand, clay) => {
  return (
    clay < 20.0 &&
    sand >= 52 - TINY &&
    !((is_loamysand(sand, clay)) || (is_sand(sand, clay))) &&
    sand >= 45 - TINY &&
    sand >= 0.0 &&
    clay >= 0.0
  ) || (
    sand < 52 &&
    clay < 8 &&
    100 - sand - clay < 50
  );
} // is_sandyloam

const is_loamysand = (sand, clay) => {
  return sand - clay >= 70 - TINY &&
	       !is_sand(sand, clay) &&
         sand >= 0.0 &&
         clay >= 0.0;
} // is_loamysand

const is_sand = (sand, clay) => {
  return (2.0 * sand - clay >= 170 - TINY) &&
         sand >= 0.0 &&
         clay >= 0.0;
} // is_sand

const determine_texture_class = (sand, silt, clay) => {
	if      (is_clay(sand,clay))			    return TXT_CLAY;
	else if (is_clayloam(sand,clay))	    return TXT_CLAYLOAM;
	else if (is_loam(sand,clay))		      return TXT_LOAM;
	else if (is_loamysand(sand,clay))	    return TXT_LOAMYSAND;
	else if (is_sand(sand,clay))		      return TXT_SAND;
	else if (is_sandyclay(sand,clay))	    return TXT_SANDYCLAY;
	else if (is_sandyclayloam(sand,clay))	return TXT_SANDYCLAYLOAM;
	else if (is_sandyloam(sand,clay))	    return TXT_SANDYLOAM;
	else if (is_silt(sand,clay))		      return TXT_SILT;
	else if (is_siltyclay(sand,clay))	    return TXT_SILTYCLAY;
	else if (is_siltyclayloam(sand,clay))	return TXT_SILTYCLAYLOAM;
	else if (is_siltyloam(sand,clay))	    return TXT_SILTYLOAM;
	else					                        return TXT_UNKNOWN;
} // determine_texture_class

const make_Estimate = (ann_model, rosinput, rosoutput) => {
  if (ann_model === ANN_MODEL.TXT) {
    if (is_valid_ssc(rosinput)) {
      // use the actual numbers rather than the combobox
      const class_index = determine_texture_class(rosinput.sand, rosinput.silt, rosinput.clay);
      rosoutput.vgthr     = class_index.TXT_THR;
      rosoutput.vgths     = class_index.TXT_THS;
      rosoutput.vgalp     = class_index.TXT_ALPHA;
      rosoutput.vgnpar    = class_index.TXT_NPAR;
      rosoutput.ks        = class_index.TXT_KS;
      rosoutput.stdvgthr  = class_index.TXT_THR_STD;
      rosoutput.stdvgths  = class_index.TXT_THS_STD;
      rosoutput.stdvgalp  = class_index.TXT_ALPHA_STD;
      rosoutput.stdvgnpar = class_index.TXT_NPAR_STD;
      rosoutput.stdks     = class_index.TXT_KS_STD;		
      rosoutput.ann_model = ann_model;
      // do not return because we still must compute unsaturated K
    } else {
	    return (SSC_INVALID);
	  }
  } else {
    // the above block was moved out of the switch because some specialized ANN stuff happens
    // this switch has a __FALL_THROUGH__ structure (no 'break' statements!). So all four 
    // cases are checked for SSCBDTH1500, 3 for SSCBDTH33, etc.
    let res = 0;

    console.log(ann_model, ANN_MODEL.SSCBDTH3315);
    switch (ann_model) {
      case ANN_MODEL.SSCBDTH3315:
        if (!is_valid_th1500(rosinput)) res |= TH1500_INVALID;
        console.log(is_valid_th1500(rosinput));
      // eslint-disable-next-line no-fallthrough
      case ANN_MODEL.SSCBDTH33:
        if (!is_valid_th33(rosinput)) res |= TH33_INVALID;
      // eslint-disable-next-line no-fallthrough
      case ANN_MODEL.SSCBD:
        if (!is_valid_bd(rosinput)) res |= BD_INVALID;
      // eslint-disable-next-line no-fallthrough
      case ANN_MODEL.SSC:
        if (!is_valid_ssc(rosinput)) res |= SSC_INVALID;
        // break here, otherwise we go through the default
        break;
      default:
        return (MODEL_INVALID);
    }

    // console.log(res, SSC_INVALID);
    if (res) {
      // we do not have valid input data
      return res;
    } else {

      let ann_index = ann_model - 1; // this is because TXT model is #0

      // MATRIX *bootstrap_output_vg4=NULL;
      // VECTOR *average_vg4=new VECTOR(4);
      // VECTOR *std_vg4=new VECTOR(4);
      // MATRIX *corr_vg4=new MATRIX(4,4);
      // MATRIX *bootstrap_output_ks=NULL;
      // VECTOR *average_ks=new VECTOR(1);
      // VECTOR *std_ks=new VECTOR(1);
      // MATRIX *corr_ks=new MATRIX(1,1);

      // this is where it all happens, first retention, then ks
      console.log(nn_model_ret[ann_index])
      const bootstrap_output_vg4 = nn_forward(nn_model_ret[ann_index], rosinput);
      // nn_model_ret[ann_index].calc_avg(bootstrap_output_vg4,average_vg4,std_vg4,corr_vg4);
      // bootstrap_output_ks=nn_model_ks[ann_index].nn_forward(&rosinput);
      // nn_model_ks[ann_index].calc_avg(bootstrap_output_ks,average_ks,std_ks,corr_ks);
      // transfer(average_vg4,std_vg4,corr_vg4,average_ks,std_ks,corr_ks,&rosoutput);
      // rosoutput.ann_model=ann_model;
    }
  } // else for ANN models

  // normalize alpha, n,ks
  rosoutput.vgalp = Math.pow(10.0, rosoutput.vgalp);
  rosoutput.vgnpar = Math.pow(10.0, rosoutput.vgnpar);
  rosoutput.ks = Math.pow(10.0, rosoutput.ks);

  rosinput.vgthr = rosoutput.vgthr;
  rosinput.vgths = rosoutput.vgths;
  // don't forget the antilog for these parameters
  //  rosinput.vgalp=pow(10,rosoutput.vgalp);
  //rosinput.vgnpar=pow(10,rosoutput.vgnpar);
  rosinput.vgalp = rosoutput.vgalp;
  rosinput.vgnpar = rosoutput.vgnpar;

  // needed for unsatK estimate
  if (rosinput.is_valid_VG4()) {  
/* TODO    
    //run ANN model for unsat-K
    MATRIX *bootstrap_output_unsk;
    VECTOR *average_unsk=new VECTOR(2);
    VECTOR *std_unsk=new VECTOR(2);
    MATRIX *corr_unsk=new MATRIX(2,2);

    bootstrap_output_unsk=nn_model_unsk[0].nn_forward(&rosinput);
    nn_model_unsk[0].calc_avg(bootstrap_output_unsk,average_unsk,std_unsk,corr_unsk);
    
    rosoutput.unsks=average_unsk->vector[1];
    rosoutput.unsl=average_unsk->vector[2];
    rosoutput.stdunsks=std_unsk->vector[1];
    rosoutput.stdunsl=std_unsk->vector[2];

    delete bootstrap_output_unsk;
    delete average_unsk;
    delete std_unsk;
    delete corr_unsk;
*/    
  } else {
    return VG4_INVALID;
  }
  // normalize unsks
  rosoutput.unsks = Math.pow(10.0, rosoutput.unsks);

  // success
  return 0;
} // make_Estimate

const rosetta = (file) => {
  const data = dataTable(readFile(file).slice(1), [
    'Matnum',
    'sand',
    'silt',
    'clay',
    'bd',
    'om',
    'th33',
    'th1500',
    'InitType',
  ]);

  const s = ['           *** Material information ****                                                                   g/g  '];
  s.push('   thr       ths         tha       th      Alfa      n        Ks         Kk       thk       BulkD     OM    Sand    Silt    InitType');
  data.forEach(row => {
    row.sand *= 100;
    row.silt *= 100;
    row.clay *= 100;

    let ann_model = ANN_MODEL.SSCBDTH3315;
    if (row.th1500 < 0 && row.th33 > 0) {
      ann_model = ANN_MODEL.SSCBDTH33;
    } else if (row.th1500 < 0 && row.th33 < 0) {
      ann_model = ANN_MODEL.SSCBD;
    }
    
    const rosoutput = {};
    const res = make_Estimate(ann_model, row, rosoutput);
  });
} // rosetta

const nn_model_ret = [twssc, twsscbd, twsscbdth33, twsscbdth3315];
const nn_model_ks = [tsssc, tssscbd, tssscbdth33, tssscbdth3315];
const nn_model_unsk = newunsk;

rosetta('MeadIr_run_01.dat');

module.exports = {rosetta};