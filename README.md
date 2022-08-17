# Redux simplified
## Development
This is a React + Redux project.

View it at https://aesl.ces.uga.edu/psa/redux-app/

### The Redux store

#### Setters and getters
To simplify Redux development, setters and getters are automatically created for everything in the store, including nested properties.

Given:
```
const initialState = {
  firstName: '',
  deeply: {
    nested: {
      property: '',
    }
  },
};
```

To write to the store:
```
import {set} from '../store/store';

const dispatch = useDispatch();

dispatch(set.firstName('John'));
dispatch(set.deeply.nested.property('Gotcha'));
```

To read from the store:
```
import {get} from '../store/store';

const firstName = useSelector(get.firstName);
const clientfirstName = useSelector(get.deeply.nested.property);
```

Note that you can still read from the store like this:
```
import {get} from '../store/store';

const firstName = useSelector(state => state.firstName);
const clientfirstName = useSelector(state => state.deeply.nested.property);
```

The `get` methods are simply syntactic sugar, which *may* be slightly slower for deeply nested properties.

However, the `set` methods save you the trouble of writing setter reducers for every property in the store.

#### afterChange ####

Setters often need side effects.  Because setters are automatically created, we need a way to hook into them.

The `afterChange` object in the store accomplishes this.

For example, this sets the document's title whenever `firstName` changes, and it outputs "Whoo hoo!" whenever `deeply.nested.property` changes:

```
const afterChange = {
  firstName: (state, action) => {
    document.title = `Welcome ${state.firstName}`;
  },
  'deeply.nested.property': (state, action) => {
    console.log('Whoo hoo!');
  },
};
```


#### "Functional" state properties ####

`initialState` can contain "functional" properties.

In this example, `fullName` will be calculated whenever `firstName` or `lastName` changes:

```
const initialState = {
  firstName: '',
  lastName: '',
  fullName: (state) => state.firstName + ' ' + state.lastName
};
```

`fullName` can then be accessed like any other state property:
```
const fullName = useSelector(get.fullName);
```

Note that the depth of the properties does not matter, so both of these work:

```
const initialState = {
  firstName: '',
  lastName: '',
  deeply: {
    nested: {
      fullName: (state) => state.firstName + ' ' + state.lastName
    }
  },
};
```

```
const initialState = {
  fullName: (state) => state.deeply.nested.firstName + ' ' + state.deeply.nested.lastName
  deeply: {
    nested: {
      firstName: '',
      lastName: '',
    }
  },
};
```


A side benefit:  Functional properties are calculated *only* when the properties they rely on change.  This means that they are "auto" memoized.

##### How it works #####

The Redux store accepts a "serializable" state only, so `initialState` generally can't contain method calls.

Before sending `initialState` to the store, the program iterates through it (recursively for nested objects), pulling out methods and changing those properties' values to their calculated values.

It parses each method's definition, looking for properties that the method references.  (In our example, `fullName`'s method references `firstName` and `lastName`.)

When (and only when) the referenced properties' setters are called, the method is run, and its result is stored in the "functional" property.

Note that the `fullName` function doesn't have to worry about mutating the state:  The reducers are sent to the store using `createReducer()`, which calls Immer.

Here's a more complete example from CC-Econ:

```
let initialState = {
  fertN: 0,
  fertP: 0,
  fertK: 0,
  $fertN: 0
  $fertP: 0,
  $fertK: 0,
  fertNAdded: 0,
  fertPAdded: 0,
  fertKAdded: 0,
  $fertApplication: 0,
  $fertCredit: (state) => state.fertN * state.$fertN + state.fertP * state.$fertP + state.fertK * state.$fertK,
  $fertCost: (state) => -(state.fertNAdded * state.$fertN + state.fertPAdded * state.$fertP + state.fertKAdded * state.$fertK) - state.$fertApplication,
  fertility: {
    ...
    total: (state) => state.$fertCredit + state.$fertCost
  },
}
```

If `fertN` changes:

- `$fertCredit`'s method will run and update `$fertCredit`'s value, because it references `state.fertN`.
- Any methods that rely on `$fertCredit` will run and update their properties – in this case, `fertility.total`.
- Any methods that rely on `fertility.total` will run.  Since there are none, the updates are finished.
- Since none of `$fertCost's` referenced properties were affected, its method will *not* run.

The standard way to write this would be to create setters for each property (`fertN` through `$fertApplication`), making sure that each setter calls functions to update `$fertCredit`, `$fertCost`, and `fertility.total`.

Now, the setters are created automatically, and `$fertCredit`, `$fertCost`, and `fertility.total` are automatically calculated as needed.

Note that functional properties don't need to be simple one-liners.

For example, this will set `state.coverCropTotal` whenever `species`, `rates`, or `prices` change:

```
let initialState = {
  // ...  
  coverCropTotal: (state) => {
    let total = 0;

    state.species
      .forEach((s, n) => {
        if (s) {
          total += (state.rates[n] || 0) * (state.prices[n] || 0);
        }
      });
    
    return total;
  },
  // ...
}
```

### `<Input>` components ###

`<Input>` components interact with the store.  The type of the store's property usually determines the `<Input>` type:

- If the property is a string, the type will be `text`.
- If the property is a Boolean, the type will be `checkbox`.
- If the property is numeric or `undefined`, the type will be `number`.
- If the property begins with a dollar sign, the type will be `number`, and a dollar sign will appear before the input.
  (If you want a "dollar" type for a property that doesn't include `$` in its name, use `type="dollar"`.)

For example, this code creates a text input for `farm`, a numeric type for `acres`, and a numeric type for `labor` with a prepended dollar sign:
```
const initialState = {
  // ...
  farm: '',
  acres: undefined,
  $labor: undefined,
  species: [],
  // ...
}

import {Input} from './Inputs';
<Input id="farm" />
<Input id="acres" />
<Input id="$labor" />
```

If the store's property is an array, include an `index` property:
```
<Input id="species" index={0} />
<Input id="species" index={1} />
<Input id="species" index={2} />
```

By default, changes to an `<Input>` are not committed to the store unless **Enter** is pressed or the `<Input>` component is blurred.  (This is in keeping with the Redux recommendation to [Avoid Putting Form State In Redux](https://redux.js.org/style-guide/#avoid-putting-form-state-in-redux).)

If changes should be committed immediately, include `immediate` as a property:
```
<Input id="farm" immediate />
```

If you want all `<Input>` elements to be committed to the store immediately, include `options="immediate"` on the form itself:
```
<form options="immediate">
```

#### Focusing `<Input>` ####
An `<Input>` can be focused like this:
```
dispatch(set.focus('farm'));
```

#### Radio groups ####
A radio group can be created like this:
```
<Input
  id="number"
  label="Pick a number"
  options={[1, 2, 3]}
  type="radio"
/>
```
![Output](https://raw.githubusercontent.com/rickhitchcock/redux-app/master/images/RadioButton1.png)

If the radio buttons' labels should be different from their values, do this:
```
<Input
  id="number"
  label="Pick a number"
  options={[1, 2, 3]}
  labels={['One', 'Two', 'Three']}
  type="radio"
/>
```
![Output](https://raw.githubusercontent.com/rickhitchcock/redux-app/master/images/RadioButton2.png)

#### `<Input>` events ####

In JavaScript, `onChange()` isn't triggered until after the input is entered or blurred.  In Material UI, it's triggered after every keystroke, which is more like JavaScript's `onInput()` event.

There are disadvantages to Material UI's `onChange()` event, because we don't necessarily want to render on every keystroke.  For this reason, the `onChange()` event for `<Input>` components works like JavaScript's method, but with one difference:  It will return the element's value as a second parameter:

```
  onChange={(event, newValue) => {
    // ...
  }}
```

You can still access the value using `event.target.value`, but it's not necessary to do so.