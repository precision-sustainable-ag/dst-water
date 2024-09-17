/* eslint-disable no-console */
import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Map from 'redux-map';
import Input from '../Inputs';
import Help from '../Help';

import { get, set } from '../../store/Store';
import './styles.scss';

const OpeningMap = () => (
  <Map
    getter={get.map}
    setter={set.map}
    layer="mapbox://styles/mapbox/outdoors-v11"
    hasSearchBar
    hasGeolocate
    hasMarkerMovable
    hasImport
    autoFocus
  />
); // OpeningMap

const InteractiveMap = () => (
  <Map
    getter={get.map}
    setter={set.map}
    hasSearchBar
    hasGeolocate
    hasMarkerMovable
    hasImport
    hasMarker
    hasNavigation
    hasCoordBar
    hasDrawing
    hasFreehand
    hasFullScreen
    hasElevation
    hasClear
    hasHelp
    otherHelp={(
      <p>
        To restart all location services, use the &quot;Clear Location&quot; button in the upper right of the screen.
      </p>
    )}
    // autoFocus
  />
); // InteractiveMap

const Location = () => {
  // console.log(1, get.map);
  // console.log(2, get.map.lat);
  // console.log(3, get.map.lon);
  // try { console.log(useSelector(get.map)); } catch (ee) { console.log(1, ee); }
  // try { console.log(useSelector(get.map.lat)); } catch (ee) { console.log(2, ee); }
  // try { console.log(useSelector(get.map.lon)); } catch (ee) { console.log(3, ee); }

  const { lat, lon } = useSelector(get.map);
  // console.log('here');
  return (
    <div className="locationWrapper">
      <div className="mapHeader">
        <div className="mapHeaderText">
          <h1>Where is your Field located?</h1>
          <p>
            Enter your address or zip code to determine your field&apos;s location.
            You can then zoom in and click to pinpoint it on the map.
            If you know your exact coordinates, you can enter them in the search bar separated by a comma (ex. 37.7, -80.2).
          </p>
        </div>
        <div className="inputsContainer">
          <Input
            label="Name your Field (optional)"
            id="field"
            autoComplete="off"
            style={{ height: '2rem', minWidth: '13rem' }}
          />
          <Help className="moveLeft">
            <p>
              This input is optional. If you enter a field name, you will be able to rerun the model on this computer without re-entering your data.
            </p>
            <p>Notes:</p>
            <ul>
              <li>
                If you have multiple fields, you will be able to select them from a drop-down menu in the upper-right.
              </li>
              <li>
                Your information is stored on your computer only. It will not be uploaded to a server.
              </li>
              <li>
                If you clear your browser&apos;s cache, you will need to re-enter your data the next time you run the program.
              </li>
            </ul>
          </Help>
        </div>
      </div>
      <div
        style={{
          justifyContent: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div className="map" style={{ width: '100%', height: '500px', border: '1px solid black' }}>
          {
            lat === 0 && lon === 0
              ? (
                <OpeningMap />
              )
              : (
                <InteractiveMap />
              )
          }
        </div>
        <div
          style={{
            justifyContent: 'space-evenly',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Link className="link" to="/home">
            BACK
          </Link>
          <Link className="link" to="/soil">
            NEXT
          </Link>
        </div>
      </div>
    </div>
  );
}; // Location

export default Location;
