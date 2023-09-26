/* eslint-disable max-len, no-alert, no-console */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex */

import React, {
  useEffect, useCallback, useState,
} from 'react';

import { SSE } from 'sse.js'; // SSE with POST
import { useSelector, useDispatch } from 'react-redux';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Dropzone from 'react-dropzone';

import { get, set } from '../../store/Store';
import './styles.scss';

import { comp } from './comp';

let globalButton;
let globalFiles = {
  Progress: '',
};

const comps = {};

comp.split('___________').forEach((s) => {
  s = s.trim().split(/[\n\r]+/);
  comps[s[0].trim().toLowerCase()] = s.slice(1).join('\n').trim();
});

// const match = (file) => {
//   const rep = (s) => {
//     if (!s) return s;

//     s = s.replace(/'(\d+)\/(\d+)\/(\d+)'/g, (_, m, d, y) => `zzz'${+m}/${+d}/${+y}'`); // dates
//     s = s.replace(/\d+\.?\d+/g, (d) => (+d).toFixed(2)); // numbers
//     s = s.replace(/[\t ]+/g, ' '); // tabs and spaces
//     s = s.replace(/\s*[\n\r]+\s*/g, '\r'); // collapse newlines
//     s = s.trim();

//     return s;
//   };

//   const s1 = rep(comps[file]);
//   const s2 = rep(files[file]);

//   if (s2 && s1 !== s2) {
//     // console.log('_________________');
//     // console.log(`%c${file}`, 'text-decoration: underline; font-weight: bold; color: brown;');
//     const c = rep(comps[file]).split(/[\n\r]/);
//     const f = rep(files[file]).split(/[\n\r]/);

//     c.forEach((cc, i) => {
//       if (rep(cc) !== rep(f[i])) {
//         for (let j = 0; j < cc.length; j++) {
//           if (cc[j] !== f[i][j]) {
//             // console.log(' ', c.slice(j - 10, j + 10), ':', f[i].slice(j - 10, j + 10));
//             j += 9;
//           }
//         }
//       }
//     });
//     // console.log('_________________');
//   }

//   return rep(s1) === rep(s2);
// }; // match

const WorksheetData = () => {
  const data = useSelector(get.worksheet);
  const site = useSelector(get.site);

  if (typeof data === 'string') {
    return (
      <pre className="data" tabIndex={0}>
        {data}
      </pre>
    );
  }

  if (!data.length) {
    return null;
  }

  const cols2 = Object.keys(data[0]);

  data.forEach((row) => { // first row may be missing data
    Object.keys(row).forEach((col) => {
      if (!cols2.includes(col)) {
        cols2.push(col);
      }
    });
  });

  return (
    <div className="data" tabIndex={0}>
      <table>
        <thead>
          <tr>
            {cols2.map((key) => <th key={key}>{key}</th>)}
          </tr>
        </thead>
        <tbody>
          {
            data.map((row, i) => (
              <tr key={i} className={JSON.stringify(row).includes(site) ? 'selected' : ''}>
                {
                  cols2.map((key) => (
                    <td key={key}>
                      {
                        Number.isFinite(row[key]) ? +(+row[key]).toFixed(5) : row[key]
                      }
                    </td>
                  ))
                }
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}; // WorksheetData

const SoilFiles = () => {
  const dispatch = useDispatch();

  const files = {
    Progress: '',
  };

  globalFiles = {
    Progress: '',
  };

  useEffect(() => {
    dispatch(set.soilfiles(files));
  });

  return <Output />;
}; // SoilFiles

let progress = '';
const Output = () => {
  const dispatch = useDispatch();
  const files = useSelector(get.soilfiles);
  const button = useSelector(get.button);

  const message = (e) => {
    const progress2 = `${globalFiles.Progress + e.data.replace(/zzz/g, '\n')}\n`;

    globalFiles = {
      ...globalFiles,
      Progress: progress2,
    };

    dispatch(set.soilfiles(globalFiles));

    if (globalButton === 'Progress') {
      dispatch(set.worksheet(progress2));
    }
    console.log(e.data);
  };

  const file = (e) => {
    globalFiles = {
      ...globalFiles,
      [e.id]: e.data.replace(/zzz/g, '\n'), // sse.js bug
    };

    dispatch(set.soilfiles(globalFiles));

    if (globalButton === 'Progress') {
      dispatch(set.worksheet(progress));
    }
    // console.log(e.data);
  };

  const runModel = () => {
    console.clear();
    progress = '';

    const evtSource = new SSE('https://api.precisionsustainableag.org/maizsim');
    evtSource.stream();

    evtSource.addEventListener('file', file);

    evtSource.addEventListener('message', message);

    evtSource.onclose = (e) => {
      console.log('closed');
      console.log(e);
      evtSource.close();
    };

    evtSource.onerror = (e) => {
      console.log('error');
      console.log(e);
      evtSource.close();
    };

    dispatch(set.button('Progress'));
    globalButton = 'Progress';
    dispatch(set.worksheet(files.Progress));
  };

  if (!Object.keys(files).length) {
    return null;
  }

  return (
    <div className="sideButtons">
      <div>
        <button
          type="button"
          onClick={runModel}
        >
          Run model
        </button>
      </div>

      <div>
        <button
          type="button"
          onClick={() => {
            if (Object.keys(files).length) {
              const zip = new JSZip();
              Object.keys(files).forEach((file2) => {
                zip.file(file2, files[file2]);
              });

              zip.generateAsync({ type: 'blob' }).then((content) => {
                saveAs(content, 'output.zip');
              });
            }
          }}
        >
          Download
        </button>
      </div>
      {
        Object.keys(files)
          .sort((a, b) => (
            a.replace('Progress', '').toUpperCase().localeCompare(b.replace('Progress', '').toUpperCase())
          ))
          .map((key) => (
            <div key={key}>
              <button
                type="button"
                className={key === button ? 'selected' : ''}
                onClick={() => {
                  dispatch(set.button(key));
                  globalButton = key;
                  dispatch(set.worksheet(files[key]));
                }}
              >
                {key}
              </button>
            </div>
          ))
      }
    </div>
  );
}; // Output

const Inputs = () => {
  const dispatch = useDispatch();
  const xl = useSelector(get.xl);
  const button = useSelector(get.button);

  return (
    <div id="Inputs">
      {
        Object.keys(xl).map((key) => (
          <button
            type="button"
            key={key}
            className={key === button ? 'selected' : ''}
            onClick={() => {
              dispatch(set.button(key));
              dispatch(set.worksheet(xl[key]));
            }}
          >
            {key}
          </button>
        ))
      }
    </div>
  );
};

const Worksheet = () => {
  const dispatch = useDispatch();
  const xl = useSelector(get.xl);
  const data = useSelector(get.data);
  const [dragging, setDragging] = useState(false);
  const site = useSelector(get.site);
  const file = useSelector(get.file);

  useEffect(() => {
    async function fetchData() {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch(`https://api.precisionsustainableag.org/getsoilfiles?id=${site}`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const responseData = await response.json();
          globalFiles = responseData;
          dispatch(set.soilfiles(globalFiles));
          console.log(Object.keys(responseData));
        } else {
          alert('File upload failed.');
        }
      } catch (error) {
        console.log('An error occurred:', error);
      }
    }

    if (site) {
      fetchData();
    }
  }, [site]);

  const handleDrop = (acceptedFiles) => {
    const newFile = acceptedFiles[0];
    dispatch(set.file(newFile));
    const reader = new FileReader();
    reader.onload = (e) => {
      dispatch(set.data(''));
      dispatch(set.newData(e.target.result));
    };
    reader.readAsArrayBuffer(newFile);
  };

  const handlePaste = useCallback((event) => {
    const clipboardData = event.clipboardData || window.clipboardData;
    const { items } = clipboardData;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && /excel|spreadsheetml/.test(item.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          dispatch(set.data(''));
          dispatch(set.newData(e.target.result));
        };
        const newFile = item.getAsFile();
        dispatch(set.file(newFile));
        reader.readAsArrayBuffer(newFile);
        event.preventDefault();
        return;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  return (
    <div
      className="Worksheet"
      onDragEnter={() => setDragging(true)}
      onDrop={() => setDragging(false)}
    >
      <p>Drag or paste an Excel file here, then select the site from the upper-right dropdown.</p>

      {
        dragging && (
          <Dropzone onDrop={handleDrop}>
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps()}
                className="dropZone"
              >
                <input {...getInputProps()} />
                Drag and drop an Excel file here
              </div>
            )}
          </Dropzone>
        )
      }

      {
        xl.Description.length > 0 && <Inputs />
      }

      {
        data && (
          <>
            <SoilFiles />
            <WorksheetData />
          </>
        )
      }
    </div>
  );
}; // Worksheet

export default Worksheet;
