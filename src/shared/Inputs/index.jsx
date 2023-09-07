import React, {
  useEffect, useState, useRef, useCallback,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  TextField,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Autocomplete as MUIAutocomplete,
} from '@mui/material';

import { get, set } from '../../store/Store';

import './styles.scss';

const keyPress = (event) => {
  if (event.key === 'Enter') {
    // focus next field
    const { form } = event.target;

    if (form) {
      let index = Array.prototype.indexOf.call(form, event.target) + 1;
      while (
        index < form.elements.length
        && form.elements[index].tagName !== 'INPUT'
      ) {
        // skip over dropdown button elements
        index += 1;
      }
      if (form.elements[index]) {
        form.elements[index].focus();
        form.elements[index].select();
      }
      event.preventDefault();
    }
  }
}; // keyPress

const Input = ({
  type,
  id,
  options,
  isOptionEqualToValue,
  renderInput,
  index = '',
  value,
  onChange,
  onInput,
  immediate,
  ...props
}) => {
  const dispatch = useDispatch();

  let obj = id;
  if (Number.isFinite(index)) {
    obj += index;
  }

  const focus = useSelector(get.focus) === obj;
  const focusRef = useRef(null);

  let sel = get;
  id.split('.').forEach((k) => { sel = sel[k]; });
  if (!sel) {
    console.warn(`Unknown Input: ${id}`); // eslint-disable-line no-console
    alert(`Unknown Input: ${id}`); // eslint-disable-line no-alert
  }

  let sel2 = useSelector(sel);

  if (sel2 && type === 'percent') {
    sel2 *= 100;
  }

  const [v2, setv2] = useState(value || sel2);

  const [changed, setChanged] = useState(false);
  const isArray = Array.isArray(sel2) && !props.multiple; // TODO

  if (!type && /\$/.test(id)) {
    type = 'dollar';
  }

  let compar;
  if (sel2 === undefined) {
    compar = 'number';
  } else if (/number|dollar|percent/.test(typeof sel2)) {
    compar = 'number';
  } else if (typeof sel2 === 'boolean') {
    compar = 'checkbox';
  } else {
    compar = 'text';
  }
  type = type || compar;

  let val = isArray ? sel2[index] || '' : sel2;

  if (type === 'dollar' && val) {
    val = (+val).toFixed(2);
  }

  const [v, setValue] = useState(val);

  useEffect(() => {
    if (v2 !== sel2 || v2 !== value) {
      setChanged(true);
    }
  }, [v2, value, sel2]);

  useEffect(() => {
    if (changed) {
      setv2(val);
      setValue(val);
      setChanged(false);
    }
    if (focus) {
      if (focusRef.current) {
        const input = focusRef.current.querySelector('input');
        input.focus();
        setTimeout(() => {
          input.focus();
          dispatch(set.focus(null));
        }, 100);
      }
    }
  }, [changed, val, focus, dispatch, props]);

  const change = (vvalue) => {
    setValue(vvalue);
  }; // change

  const update = useCallback((e, newValue) => {
    if (newValue === value && sel2 !== undefined) return; // == in case numeric

    setChanged(true);

    if (/dollar|number|percent/.test(type)) {
      if (newValue === '') {
        newValue = undefined;
      } else {
        newValue = +newValue;
      }
    }

    let s = set;
    // eslint-disable-next-line arrow-parens, no-return-assign
    id.split('.').forEach(k => s = s[k]);

    if (type === 'percent') {
      newValue /= 100;
    }

    if (isArray) {
      if (sel2[index] !== newValue) {
        dispatch(s({ index, value: newValue }));
      }
    } else if (sel2 !== newValue) {
      dispatch(s(newValue));
    }

    if (onChange) {
      onChange(e, newValue);
    }
  }, [onChange, value, dispatch, id, index, isArray, sel2, type]); // update

  value = value !== undefined ? value : val;

  if (/dollar|percent/.test(type)) {
    props.className = `${props.className || ''} ${type}`;
  }

  useEffect(() => {
    if (value) {
      update({ target: { value } }, value);
    }
  }, [update, value, type]);

  if (type === 'checkbox') {
    if (value === '') {
      value = false;
    } else if (value === 'on') {
      value = true;
    } else if (value !== true && value !== false) {
      alert(`Bad Boolean value for ${id}: ${value}`); // eslint-disable-line no-alert
    }
  }

  if (type === 'radio' && options) {
    return (
      <>
        <FormLabel>{props.label}</FormLabel>
        <RadioGroup {...props}>
          {options.map((option, i) => (
            <FormControlLabel
              value={option}
              key={option}
              control={<Radio sx={{ padding: '0.2rem 0.5rem' }} />}
              label={props.labels ? props.labels[i] : option}
              checked={option.toString() === value?.toString()}
              onChange={(e) => {
                change(e.target.value);
                update(e, e.target.value);
              }}
            />
          ))}
        </RadioGroup>
      </>
    );
  } if (options) {
    // let max = Math.max.apply(Math, options.map(option => option.description ? option.description.length : option.length));

    const max = '100%';
    if (!isOptionEqualToValue) {
      isOptionEqualToValue = (option, valu) => option.value === valu?.value;
    }

    if (!renderInput) {
      renderInput = (params) => (
        <TextField
          autoFocus={props.autoFocus}
          variant={props.variant || 'outlined'}
          sx={{ background: 'white', width: max, padding: 0 }}
          placeholder={props.placeholder}
          {...params}
        />
      );
    }

    return (
      <MUIAutocomplete
        {...props}
        id={id}
        onKeyPress={keyPress}
        ref={focusRef}
        sx={{ width: max }}
        groupBy={props.groupBy}
        getOptionLabel={props.getOptionLabel}
        onInputChange={props.onInputChange}
        includeInputInList={props.includeInputInList}
        filterSelectedOptions={props.filterSelectedOptions}
        renderInput={renderInput}
        options={options}
        value={v}
        onChange={(evt, va) => {
          update(evt, va);
        }}
      />
    );
  }
  return (
    <>
      <TextField
        {...props}
        id={id}
        value={v === undefined ? '' : v} // https://github.com/facebook/react/issues/6222
        onFocus={(e) => e.target.select()}
        size="small"
        type={/dollar|percent/.test(type) ? 'number' : type || 'text'}
        sx={{
          display: props.fullWidth ? 'block' : 'span',
          boxSizing: 'border-box',
        }}
        variant={props.variant || 'outlined'}
        inputProps={{
          role: 'presentation',
          autoComplete: 'off',
          style: {
            paddingLeft: 7,
            paddingTop: 5,
            paddingBottom: 5,
            maxWidth: /number|dollar|percent/.test(type) ? 70 : 1000,
            background: 'white',
            ...props.style,
          },
        }}
        ref={focusRef}
        onKeyPress={keyPress}
        onWheel={(e) => e.target.blur()} // https://github.com/mui/material-ui/issues/7960#issuecomment-760367956
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.nativeEvent.preventDefault(); // for number type
          } else if (e.key === 'Enter') {
            update(e, e.target.value);
          }
        }}
        onChange={(e) => {
          change(e.target.value);
          if (
            immediate
              || (e.target.form
                && (e.target.form.getAttribute('options') || '').includes(
                  'immediate',
                ))
          ) {
            update(e, e.target.value);
          }
        }}
        onBlur={(e) => {
          if (
            !(
              immediate
                || (e.target.form
                  && (e.target.form.getAttribute('options') || '').includes(
                    'immediate',
                  ))
            )
          ) {
            update(e, e.target.value);
          }
        }}
        onInput={(e) => {
          if (onInput) {
            onInput(e);
          }
        }}
      />
      {props.warning}
    </>
  );
}; // Input

export default Input;
