import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { get, set } from '../../store/Store';
import './styles.scss';

const Soil = () => {
  const dispatch = useDispatch();
  const gotSSURGO = useSelector(get.gotSSURGO);
  const SSURGO = useSelector(get.SSURGO);
  const lat = useSelector(get.map.lat);

  useEffect(() => {
    if (!gotSSURGO) {
      dispatch(set.map.lat(lat));
    }
  }, [gotSSURGO, dispatch, lat]);

  if (!gotSSURGO) {
    return <>Querying SSURGO database &hellip;</>;
  }

  // console.log(SSURGO);

  const depth = {};
  SSURGO.forEach((data) => {
    depth[`${data.hzdept_r} - ${data.hzdepb_r} cm`] = {
      sand: (+data.sandtotal_r).toFixed(1),
      silt: (+data.silttotal_r).toFixed(1),
      clay: (+data.claytotal_r).toFixed(1),
      om: (+data.om_r).toFixed(2),
      bd: (+data.dbthirdbar_r).toFixed(2),
      th33: (+data.wthirdbar_r).toFixed(2),
      th1500: (+data.wfifteenbar_r).toFixed(2),
    };
  });

  return (
    <div className="Soil">
      <h1>Tell us about your Soil</h1>
      {gotSSURGO
        ? (
          <>
            <p className="note">
              The data below was pulled from NRCS&apos;s Soil Survey Geographic database (SSURGO) based
              on your field&apos;s latitude/longitude coordinates.
            </p>
            {/*
            <p className="note">
              You can adjust them if you have lab results.
            </p>
          */}
          </>
        )
        : ''}

      <table>
        <thead>
          <tr>
            <th>Soil depth</th>
            <th>
              Sand
              <br />
              (%)
            </th>
            <th>
              Silt
              <br />
              (%)
            </th>
            <th>
              Clay
              <br />
              (%)
            </th>
            <th>
              Organic matter
              <br />
              (%)
            </th>
            <th>
              Bulk density
              <br />
              (g/cm3)
            </th>
            <th>
              Drained upper limit
              <br />
              (%)
            </th>
            <th>
              Crop lower limit
              <br />
              (%)
            </th>
            <th>
              Soil inorganic N
              <br />
              (ppm or mg/kg)
            </th>
          </tr>
        </thead>
        <tbody>
          {
            Object.keys(depth).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map((d) => (
              <tr key={d}>
                <td>{d}</td>
                <td>{depth[d].sand}</td>
                <td>{depth[d].silt}</td>
                <td>{depth[d].clay}</td>
                <td>{depth[d].om}</td>
                <td>{depth[d].bd}</td>
                <td>{depth[d].th33}</td>
                <td>{depth[d].th1500}</td>
              </tr>
            ))
          }
        </tbody>
      </table>

      <div className="bn">
        <Link className="link" to="/location">BACK</Link>
        <Link className="link" to="/worksheet">NEXT</Link>
      </div>
    </div>
  );
}; // Soil

export default Soil;
