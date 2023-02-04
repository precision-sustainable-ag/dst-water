/* eslint-disable no-console */
/* eslint-disable import/prefer-default-export */
// ____________________________________________________________________________________________________________________________________
// emulate C# DataTable
const dataTable = (data, columns) => {
  if (!data[0]) {
    data = Array(data.length).fill().map(() => Array(columns.length).fill(0));
  }

  data.forEach((row, i) => {
    row = row || [];
    data[i] = new Proxy(row, {
      get(target, key) {
        if (key === 'splice') { // https://stackoverflow.com/a/54136394/3903374
          const origMethod = target.splice;
          return function temp(...args) {
            origMethod.apply(target, args);
          };
        }
        if (key in target) {
          return target[key];
        }
        const idx = columns.indexOf(key);
        if (idx === -1) {
          console.error(`Error: ${key}\n${columns}`);
        }
        return target[idx];
      },
      set(target, key, value) {
        if (Number.isFinite(+key)) {
          target[key] = value;
        } else {
          const idx = columns.indexOf(key);
          if (idx === -1) {
            console.error(`Error: ${key}\n${columns}`);
          }
          target[idx] = value;
        }
        return true; // prevent "'set' on proxy: trap returned falsish for property ..."
      },
    });
  });

  data.columns = columns;

  data.remove = (column) => {
    const idx = columns.indexOf(column);
    data.forEach((row) => {
      row.splice(idx, 1);
    });
    data.columns.splice(idx, 1);
  };

  return data;
}; // dataTable

export { dataTable };
