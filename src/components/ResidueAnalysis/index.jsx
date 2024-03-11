/* eslint-disable no-console */
import React, { useEffect, useState } from 'react';
import {
  STATES, geospatialProcessing, getModelPaths, loadTemplateFiles,
} from './utils';

const ResidueAnalysis = () => {
  const desc = 'Residue Analysis';
  // const [templateFile, setTemplateFile] = useState({});
  const [state, setState] = useState(STATES[0].state);
  const [county, setCounty] = useState(STATES[0].counties[0]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await loadTemplateFiles('MD', 'Frederick_test');
      const init = data.Init;
      const ccTerminationDate = data.Fertilization;
      const fileDir = getModelPaths('MD', 'Frederick_test');
      geospatialProcessing(fileDir, init, ccTerminationDate);
    };
    fetchData();
  }, [state, county]);

  return (
    <>
      <div>{desc}</div>

      <div>
        Select state
        <select
          style={{ marginLeft: '4%' }}
          value={state}
          onChange={(event) => { setState(event.target.value); }}
        >
          {STATES.map((stateVal) => (
            <option key={stateVal.state} value={stateVal.state}>{stateVal.state}</option>
          ))}
        </select>
      </div>

      <div>
        Select county
        <select
          style={{ marginLeft: '2%' }}
          value={county}
          onChange={(event) => { setCounty(event.target.value); }}
        >
          {STATES.filter(((stateVal) => stateVal.state === state))[0].counties.map((countyVal) => (
            <option key={countyVal} value={countyVal}>{countyVal}</option>
          ))}
        </select>
      </div>
    </>
  );
};

export default ResidueAnalysis;
