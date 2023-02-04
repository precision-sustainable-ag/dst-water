import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { get } from '../../store/Store';
import './styles.scss';
import Input from '../../shared/Inputs';

const Section = ({ title, section }) => {
  const inputs = useSelector(get[section]);
  return (
    <>
      <thead>
        <tr><th colSpan={4}>{title || section}</th></tr>
      </thead>
      <tbody>
        {Object.keys(inputs).map((input) => {
          const id = `${section}.${input}.value`;
          if (inputs[input].hidden) {
            return null;
          }
          return (
            <tr key={input}>
              <td>
                {inputs[input].label || input}
              </td>
              <td>
                <Input id={id} options={inputs[input].options} />
              </td>
              <td>
                {inputs[input].unit}
              </td>
              <td>
                {inputs[input].description}
              </td>
            </tr>
          );
        })}
      </tbody>
    </>
  );
}; // Section

const Inputs = () => (
  <div className="Inputs">
    <h1>Inputs</h1>
    <table>
      <Section section="Biology" />
      <Section section="Climate" />
      <Section section="Fertilization" />
      <Section section="GridRatio" />
      <Section section="Irrigation" />
      <Section section="Soil" />
    </table>

    <div className="bn">
      <Link className="link" to="/soil">BACK</Link>
      <Link className="link" to="/worksheet">NEXT</Link>
    </div>
  </div>
); // Inputs

export default Inputs;
