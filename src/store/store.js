import {configureStore, createAction, createReducer} from '@reduxjs/toolkit';

const initialState = {
  focus: null,
  site: '',
  worksheetName: '',
  worksheet: [],
  xl: {
    Description:    [],
    Biology:        [],
    Climate:        [],
    Fertilization:  [],
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
  }
};

const sets = {};
const gets = {};

const funcs = {};
const methods = {};

const processMethods = ((state, key) => {
  if (methods[key]) {
    for (let k in methods[key]) {
      let st = state;
      for (const key of k.split('.').slice(0, -1)) st = st[key];
      const l = k.includes('.') ? k.split('.').slice(-1)[0] : k;
      st[l] = methods[key][k](state);
      processMethods(state, k);
    }
  }
});

const afterChange = {
};

const builders = (builder) => {
  const recurse = (obj, set, get, parents = []) => {
    Object.keys(obj).forEach((key) => {
      const isArray = Array.isArray(obj[key]);
      const isObject = !isArray && obj[key] instanceof Object;
      const fullkey = parents.length ? parents.join('.') + '.' + key : key;

      if (key !== 'name') { // TODO
        get[key] = (state) => {
          let st = state;
          for (const k of parents) st = st[k];

          if (!st) {
            alert('Unknown: ' + fullkey);
          }
          return st[key];
        }

        if (typeof obj[key] === 'function') {
          funcs[fullkey] = obj[key];
          let m = obj[key].toString().match(/\b(state|e)\b\.[$_\w.(]+/g);  // state.* unbuilt, e.* built
          if (m) {
            console.log(m);
            m = m.map(s => s.split(/\./).slice(1).join('.')?.split(/\.\w+\(/)[0].replace('.length', ''));  // remove .forEach(, etc.
            console.log(m);
            // m = m.map(s => s.split(/\./)[1]);  // remove .forEach(, etc.
            m.forEach(m => {
              methods[m] = methods[m] || {};
              methods[m][fullkey] = funcs[fullkey];
            });
          }
  
          obj[key] = obj[key](initialState);
          // return;
        }
      }

      if (key !== 'name') { // TODO
        set[key] = createAction(fullkey);

        builder
          .addCase(set[key], (state, action) => {
            let st = state;
            for (const k of parents) st = st[k];

            if (isArray && Number.isFinite(action.payload.index)) {
              const {index, value} = action.payload;
              if (st[key][index] !== value) { // TODO: is this check needed?
                st[key][index] = value;
              }
            } else {
              if (st[key] !== action.payload) { // TODO: is this check needed?
                st[key] = action.payload;
              }
            }
            
            if (afterChange[fullkey]) {
              const ac = afterChange[fullkey](state, action);
              if (ac) {
                ac.forEach(parm => afterChange[parm](state, action));
              }
            }

            // TODO:  Is the first of these needed?
              processMethods(state, key);
              processMethods(state, fullkey);

            if (afterChange[fullkey]) {
              let m = afterChange[fullkey].toString().match(/state.[$_\w.(]+/g);
          
              if (m) {
                m = m.forEach(s => {
                  s = s.split('state.')[1];
                  if (s) {
                    processMethods(state, s.split(/\.\w+\(/)[0]);
                  }
                });
              }
            }
          }
        );
      }

      if (isObject) {
        recurse(obj[key], set[key], get[key], [...parents, key]);
      }
    });
  } // recurse

  recurse(initialState, sets, gets);
} // builders

export const runBuilders = () => createReducer(initialState, builders);

const mystore = configureStore({
  reducer: createReducer(initialState, builders)
});

export const store = mystore;

export const set = sets;
export const get = gets;

console.log({
  set,
  get,
  funcs,
  methods
});
