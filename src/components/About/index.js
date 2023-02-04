import React from 'react';
import { Link } from 'react-router-dom';

const About = () => (
  <div className="about">
    <h2>CC-NCALC estimates:</h2>
    <ul>
      <li>How much N is released from decomposing residues over time,</li>
      <li>The amount of undecomposed residue remaining over time,</li>
      <li>Corn N uptake based on yield goal, and</li>
      <li>N fertilizer recommendations for the subsequent cash crop that accounts for cover crop N credit.</li>
    </ul>

    <h2>Background:</h2>
    <p>
      Cover crops influence nitrogen (N) management to subsequent cash crops.
      Some of the N taken up or fixed by the cover crops becomes available over the cash crop growing season following termination.
      Estimating the rate of N release is challenging.
      The
      {' '}
      <strong>Cover Crop N Calculator</strong>
      {' '}
      provides a user-friendly approach to estimate decay of cover crop residues and release of N for offsetting N fertilizer inputs.
      This tool was developed for farmers and agricultural professionals.
    </p>
    <p>
      The N calculator is adapted from the original CERES-N (N subroutine of the Crop Environment REsource Synthesis) sub-model.
      Data from controlled laboratory experiments and on-farm cover crop decomposition studies across diverse environments were used in its
      development. Depending on residue placement, the calculator uses soil moisture and soil temperature (for incorporated residues) or
      residue water potentialand air temperature (for surface residues) to adjust decomposition rates.
    </p>

    <h2>Input data requirements:</h2>
    <p>
      Based on field location (latitude and longitude), the calculator automatically imports:
    </p>
    <ul>
      <li>
        Local soil properties (organic matter and bulk density) from the NRCS&apos;s Soil Survey Geographic database (
        <a target="_blank" rel="noreferrer" href="https://ssurgo.covercrop-data.org/">SSURGO</a>
        ),
      </li>
      <li>
        Daily soil moisture and soil temperature from
        <a target="_blank" rel="noreferrer" href="https://docs.clearag.com/documentation/Soil_Conditions/Soil_Conditions/latest">Iteris</a>
        , and
      </li>
      <li>
        Hourly weather (air relative humidity, air temperature, and rain) data from a
        <a target="_blank" rel="noreferrer" href="https://weather.covercrop-data.org/">weather API</a>
        {' '}
        to estimate surface residue environmental conditions.
      </li>
    </ul>

    <p>At a minimum, users need to provide:</p>
    <ul>
      <li>Field location,</li>
      <li>Cover crop biomass on a dry weight basis,</li>
      <li>Cover crop N concentration.</li>
    </ul>

    <p>If available, users should also provide:</p>
    <ul>
      <li>Cover crop residue chemistry (i.e., Carbohydrate, Holo-cellulose, and lignin concentrations).</li>
      <li>Cover crop water content at termination.</li>
    </ul>

    <p>
      If these data are unavailable, the program will estimate cover crop residue chemistry based on N concentrations
      and will use a default value for cover crop water content at termination.
    </p>

    <p>
      <strong><em>CC-NCALC uses real-time weather data and five year historic averages for days where data are not yet available.</em></strong>
    </p>

    <p className="center" style={{ margin: 25 }}>
      <Link className="link" to="/location">GET STARTED</Link>
    </p>

    <p style={{ fontSize: '90%' }}>
      <em>
        For more information about
        <strong>Precision Sustainable Agriculture</strong>
        {' '}
        projects, please visit
        <a href="https://precisionsustainableag.org/">https://precisionsustainableag.org/</a>
        .
      </em>
    </p>
  </div>
); // About

About.showInMenu = false;

export default About;
