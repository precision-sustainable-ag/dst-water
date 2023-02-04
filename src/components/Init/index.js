import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as XLSX from 'xlsx';

import { set, get } from '../../store/Store';
import './styles.scss';

const Init = () => {
  const dispatch = useDispatch();
  const site = useSelector(get.site);
  const xl = useSelector(get.xl);
  const sites = useSelector(get.sites);

  useEffect(() => {
    if (!xl.Description.length) {
      fetch('AGMIPET2Sim.xlsx')
      // fetch('kansas.xlsx')
        .then((response) => response.arrayBuffer())
        .then((data) => {
          const wb = XLSX.read(data, { type: 'binary' });

          dispatch(set.data(wb));

          Object.keys(xl).forEach((key) => {
            const dataVal = XLSX.utils.sheet_to_json(wb.Sheets[key]).map((row) => {
              Object.keys(row).forEach((keyVal) => {
                if (keyVal !== keyVal.toLowerCase()) {
                  row[keyVal.toLowerCase()] = row[keyVal];
                  delete row[keyVal];
                }
              });
              return row;
            });

            dispatch(set.xl[key](dataVal));
          });

          dispatch(set.site(wb.Sheets.Description.A2.v));

          const desc = wb.Sheets.Description;
          dispatch(set.sites(Object.keys(desc).filter((d) => /^A/.test(d)).map((d) => desc[d].v).filter((d) => !(/id/i.test(d)))));

          // console.log(data);
        });
    }
  }, [dispatch, xl]);

  const changeSite = (e) => {
    dispatch(set.site(e.target.value));
  };

  return (
    <select
      id="Sites"
      onChange={changeSite}
      value={site}
    >
      {
        sites.map((siteVAL) => <option key={siteVAL}>{siteVAL}</option>)
      }
    </select>
  );
};

export default Init;
