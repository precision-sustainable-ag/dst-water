import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Slider } from '@mui/material';
import Input from '../Inputs';

import { get, set } from '../../store/Store';

import './index.scss';

const Myslider = ({
  id, min, max, step = 1, autoFocus, onInput,
}) => {
  const dispatch = useDispatch();
  const val = useSelector(get[id]);

  min = +min;
  max = +max;
  return (
    <div className="slider">
      <Input
        id={id}
        autoComplete="off"
        autoFocus={autoFocus}
        style={{ width: '5em' }}
        onInput={onInput}
        variant="standard"
      />
      &nbsp;&nbsp;&nbsp;&nbsp;
      <span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span className="tiny">{min}</span>
          <Slider
            value={Number.isFinite(val) ? +(+val).toFixed(step === 1 ? 0 : 1) : 0}
            onChange={(_, newValue) => {
              if (onInput) {
                onInput();
              }
              dispatch(set[id](+newValue));
            }}
            aria-labelledby="input-slider"
            min={min}
            max={max}
            step={step}
            valueLabelDisplay={val <= max ? 'off' : 'off'}
            tabIndex={-1}
          />
          <span className="tiny">{max}</span>
        </div>
      </span>
    </div>
  );
};

export default Myslider;
