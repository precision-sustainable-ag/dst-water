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
} // arg

const exit = (s => {
  console.log(s);
  process.exit();
});

const error = (s => {
  console.error(s);
  process.exit();
});

// emulate C# DataTable
const dataTable = (data, columns) => {
  if (!data[0]) {
    data = Array(data.length).fill().map(e => Array(columns.length).fill(0));
  }

  data.forEach((row, i) => {
    row = row || [];
    data[i] = new Proxy(row, {
      get(target, key) {
        if (key === 'splice') { // https://stackoverflow.com/a/54136394/3903374
          const origMethod = target.splice;
          return function (...args) {
            origMethod.apply(target, args);
          }
        }
        if (key in target) {
          return target[key];
        } else {
          const idx = columns.indexOf(key);
          if (idx === -1) {
            exit('Error: ' + key + '\n' + columns);
          }
          return target[idx];
        }
      },
      set(target, key, value) {
        if (Number.isFinite(+key)) {
          target[key] = value;
        } else {
          const idx = columns.indexOf(key);
          if (idx === -1) {
            exit('Error: ' + key + '\n' + columns);
          }
          target[idx] = value;
        }
      }
    });
  });

  data.columns = columns;

  data.remove = (column) => {
    const idx = columns.indexOf(column);
    data.forEach(row => {
      row.splice(idx, 1);
    });
    data.columns.splice(idx, 1);
  }

  return data;
} // dataTable

module.exports = {readFile, arg, exit, error, dataTable};
