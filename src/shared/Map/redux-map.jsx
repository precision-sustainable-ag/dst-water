/* eslint-disable no-underscore-dangle */
import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

const MAPBOX_TOKEN = typeof process !== 'undefined'
  ? process.env.REACT_APP_MAPBOX_API_KEY
  : import.meta.env.VITE_MAPBOX_API_KEY;

import area from '@turf/area';
import bbox from '@turf/bbox';
import union from '@turf/union';
import centroid from '@turf/centroid';
import { polygon, featureCollection } from '@turf/helpers';

import * as shapefile from 'shapefile';
import { geocodeReverse, coordinatesGeocoder } from './helpers';

import fullscreenIcon from './fullscreen.png';
import polygonIcon from './polygon.png';
import freehandIcon from './freehand.png';
import trashcanIcon from './trashcan.png';

import styles from './map.module.scss';

import './mapbox-gl.css';
import './mapbox-gl-draw.css';
import './mapbox-gl-geocoder.css';
import './psa-mapbox.scss';

const turf = {
  area,
  polygon,
  bbox,
  union,
  featureCollection,
  centroid,
};

const conus = [
  [-124.731422, 24.743319], // Southwest coordinates
  [-66.969849, 49.345786], // Northeast coordinates
];

const getBounds = (bounds) => {
  if (bounds === 'conus') return conus;
  return bounds;
};

const elevations = {};

let fpolygon = [[]];

const Help = ({
  hasMarkerMovable, hasFreehand, hasFullscreen, hasImport, otherHelp,
}) => (
  <dialog id="MapHelp">
    <button
      type="button"
      onClick={(event) => {
        event.target.closest('dialog').close();
      }}
    >
      X
    </button>
    <p><strong>Controls</strong></p>

    {
      hasMarkerMovable
        ? (
          <p>
            You can move the marker by dragging it.
          </p>
        )
        : null
    }

    {
      hasFullscreen
        ? (
          <p>
            For a larger map after the location is selected, click the full screen icon:
            <img className="icon" alt="fullscreen" src={fullscreenIcon} />
          </p>
        )
        : null
    }

    <p>
      You can use the polygon tool on the right side of the map to outline the site area and estimate its acreage:
      <img className="icon" alt="polygon" src={polygonIcon} />
      <br />
      To create the boundary, click on each point that defines your field on the map.
      <br />
      Double-click the final point to close the polygon.
    </p>

    {
      hasFreehand
        ? (
          <p>
            You can also use the freehand tool to outline the site area and estimate its acreage:
            <img className="icon" alt="freehand" src={freehandIcon} />
            <br />
            To create the boundary, click on the edge of your field and drag the mouse around the perimeter.
            <br />
            Release the mouse button to close the polygon.
          </p>
        )
        : null
    }

    {
      hasImport
        ? (
          <p>
            If you already have a shape file with your field boundaries, you can import it by clicking the&nbsp;
            <strong>SHP</strong>
            &nbsp;button.
          </p>
        )
        : null
    }

    <p>
      To delete and re-draw polygons, select the polygon, then click the trash can icon under the polygon tool:
      <img className="icon" alt="trashcan" src={trashcanIcon} />
    </p>

    {otherHelp}
  </dialog>
);

const useSafeSelector = (fallbackValue, parm, getter, setter) => {
  const dispatch = useDispatch();

  const selectedValue = useSelector(getter?.[parm] || (() => fallbackValue));

  const [localState, setLocalState] = useState(selectedValue);

  useEffect(() => {
    if (parm === 'features' && JSON.stringify(fallbackValue) === JSON.stringify(selectedValue)) {
      return;
    }
    if (parm === 'address' && !fallbackValue) {
      setLocalState({});
    } else if (fallbackValue && !getter?.[parm]) {
      setLocalState(fallbackValue);
    }
  }, [fallbackValue]);

  const setLocalStateWithDispatch = (newValue) => {
    setLocalState(newValue);

    if (setter) {
      dispatch(setter((currentMap) => ({
        ...currentMap,
        [parm]: newValue,
      })));
    }
  };

  return [localState, setLocalStateWithDispatch];
}; // useSafeSelector

const ReduxMap = ({
  getter,
  setter,
  setMap = () => {},
  setProperties = () => {},
  initWidth,
  initHeight,
  initFeatures = [],
  initAddress = 'Search for your address ...',
  initLat = 0,
  initLon = 0,
  initStartZoom,
  hasClear = false,
  hasSearchBar = false,
  hasMarker = false,
  hasNavigation = false,
  hasCoordBar = false,
  hasFreehand = false,
  hasDrawing = false,
  hasGeolocate = false,
  hasFullScreen = false,
  hasMarkerMovable = false,
  hasImport = false,
  hasElevation = false,
  hasHelp = false,
  scrollZoom = true,
  dragRotate = true,
  dragPan = true,
  keyboard = true,
  doubleClickZoom = false,
  touchZoomRotate = true,
  markerOptions = {},
  autoFocus = false,
  layer = 'mapbox://styles/mapbox/satellite-streets-v12',
  initBounds,
  fitMapToPolygons = false,
  fitBounds = false,
  defaultZoom = 15,
  showZoom = false,
  otherHelp,
}) => {
  let newPolygon;

  const boundsPadding = hasSearchBar ? 50 : 20;

  const [lat, setLat] = useSafeSelector(initLat, 'lat', getter, setter);
  const [lon, setLon] = useSafeSelector(initLon, 'lon', getter, setter);
  const [polygonArea, setPolygonArea] = useSafeSelector(0, 'area', getter, setter);
  const [elevation, setElevation] = useSafeSelector(0, 'elevation', getter, setter);
  // const [address, setAddress] = useSafeSelector({
  //   address: '',
  //   fullAddress: '',
  //   city: '',
  //   county: '',
  //   state: '',
  //   stateCode: '',
  //   zipCode: '',
  // }, 'address', getter, setter);
  const [address, setAddress] = useSafeSelector(null, 'address', getter, setter);
  const [features, setFeatures] = useSafeSelector(initFeatures, 'features', getter, setter);
  const [zoom, setZoom] = useSafeSelector(initStartZoom ?? defaultZoom, 'zoom', getter, setter);
  const [bounds, setBounds] = useSafeSelector(initBounds, 'bounds', getter, setter);

  useEffect(() => {
    setProperties({
      lat,
      lon,
      elevation,
      zoom,
      area: polygonArea,
      bounds,
      address: address ?? {},
      features,
    });
  }, [lat, lon, elevation, zoom, polygonArea, bounds, address, features]);

  const [cursorLoc, setCursorLoc] = useState({ longitude: undefined, latitude: undefined });
  const [isDrawActive, setIsDrawActive] = useState(false);
  const [searchBox, setSearchBox] = useState();
  const [dragging, setDragging] = useState(false);

  const map = useRef();
  const mapContainer = useRef();
  const drawerRef = useRef();
  const markerRef = useRef();
  const popupRef = useRef();
  const geocoderRef = useRef();
  const cursorRef = useRef();

  const inFreehand = () => mapContainer.current?.querySelector('#freehand')?.classList?.contains('active');

  const acreDiv = 4046.856422;

  const popup = (plat, plon) => (`
    <div class="popup">
      <div>Click to drag</div>
      ${plat.toFixed(4)}, ${plon.toFixed(4)}
    </div>
  `);

  const calcArea = (f) => {
    const newFeatures = JSON.parse(JSON.stringify(f));
    let totalArea = 0;
    if (newFeatures.length === 1) {
      totalArea = turf.area(newFeatures[0]) / acreDiv;
    } else {
      const polygons = newFeatures.map((feature) => {
        feature.geometry.coordinates[0].push(feature.geometry.coordinates[0][0]); // may not be self-closing
        return turf.polygon(feature.geometry.coordinates);
      });

      if (polygons.length) {
        const punion = turf.union(turf.featureCollection(polygons));
        totalArea = turf.area(punion) / acreDiv;
      }
    }

    return totalArea;
  }; // calcArea

  const updateFeatures = (newLat, newLon) => {
    const newFeatures = [];
    const { sources } = map.current.getStyle();
    drawerRef?.current?.deleteAll?.();

    Object.keys(sources).forEach((sourceName) => {
      const source = map.current.getSource(sourceName);
      if (source.type === 'geojson') {
        const data = { ...source._data };
        const f = data.features || [data];
        newFeatures.push(...f.filter((feature) => /Polygon/.test(feature.geometry.type)));
      }
    });

    setFeatures(newFeatures);
    setPolygonArea(calcArea(newFeatures));

    if (newLat) {
      setLat(newLat);
      setLon(newLon);
    }
  }; // updateFeatures

  if (searchBox && autoFocus) {
    searchBox.focus();
  }

  // useEffect definitions

  /**
   * Handles click and mousemove events for the Mapbox Geocoder searchbox.
   *
   * This effect attaches event listeners to the Mapbox Geocoder container (`.mapboxgl-ctrl-geocoder`).
   * When a user clicks within the last 20 pixels of the container's width, it triggers a reset of various states
   * including latitude, longitude, polygon area, and address details. The mousemove event toggles a CSS class
   * if the cursor is hovering near the right edge of the container.
   *
   * @effect
   * Attaches the `click` and `mousemove` event listeners to the Geocoder container when the component mounts,
   * and removes them when the component unmounts or the `map` dependency changes.
   */
  useEffect(() => { // map.current
    const handleClick = (event) => {
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      if (hasClear && rect.width - clickX <= 20) {
        setLat(0);
        setLon(0);
        setPolygonArea(0);
        setAddress({
          fullAddress: '',
          city: '',
          county: '',
          state: '',
          stateCode: '',
          zipCode: '',
        });
        setFeatures([]);
        setBounds('conus');
      }
    };

    const handleMousemove = (event) => {
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      target.classList.toggle('clearHovered', rect.width - clickX <= 20);
    };

    const geocoderContainer = document.querySelector('.mapboxgl-ctrl-geocoder');
    geocoderContainer?.addEventListener('click', handleClick);
    geocoderContainer?.addEventListener('mousemove', handleMousemove);

    return () => {
      geocoderContainer?.removeEventListener('click', handleClick);
      geocoderContainer?.removeEventListener('mousemove', handleMousemove);
    };
  }, [map.current]);

  useEffect(() => { // markerRef.current
    const handleMarkerEnter = (event) => {
      if (event.buttons === 0) {
        markerRef.current.togglePopup();
      }
    };

    const handleMarkerLeave = (event) => {
      if (event.buttons === 0) {
        markerRef.current.getPopup().remove();
      }
    };

    if (hasMarkerMovable && markerRef.current) {
      markerRef.current.getElement().addEventListener('mouseenter', handleMarkerEnter);
      markerRef.current.getElement().addEventListener('mouseleave', handleMarkerLeave);

      // update Popup content while marker is being dragged
      markerRef.current.on('drag', () => {
        markerRef.current.getPopup().setHTML(popup(markerRef.current.getLngLat().lat, markerRef.current.getLngLat().lng));
      });

      markerRef.current.on('dragend', (e) => {
        const lngLat = e.target.getLngLat();
        setLat(lngLat.lat);
        setLon(lngLat.lng);
        map.current.setCenter(lngLat);
      });
    }

    return () => {
      markerRef?.current?.getElement().removeEventListener('mouseenter', handleMarkerEnter);
      markerRef?.current?.getElement().removeEventListener('mouseleave', handleMarkerLeave);
    };
  }, [markerRef.current]);

  // ________________________________________________________________________________
  /**
   * Loads and processes a shapefile uploaded by the user.
   *
   * This function reads a shapefile from an uploaded file using the File API,
   * processes the shapefile's geometry to calculate the centroid, bounding box,
   * and area. The processed data is then used to update the map's features, bounds,
   * polygon area, and the latitude/longitude of the map's center.
   */
  const loadShapeFile = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      const layers = [];
      shapefile
        .open(arrayBuffer)
        .then((source) => {
          source.read()
            .then(function log(result) {
              if (result.done) return;
              layers.push(result.value);

              // eslint-disable-next-line consistent-return
              return source.read().then(log);
            })
            .catch((error) => console.error(error))
            .finally(() => {
              console.log('Finished processing the shapefile.');
              mapContainer.current.scrollIntoView();

              const fc = {
                type: 'FeatureCollection',
                features: layers,
              };
              const [avgLon, avgLat] = turf.centroid(fc).geometry.coordinates;

              setFeatures(layers);
              setBounds(turf.bbox(fc));
              setPolygonArea(turf.area(fc) / acreDiv);
              setLat(avgLat);
              setLon(avgLon);
            });
        })
        .catch((error) => {
          alert(`Could not process file:\n${error}`);
          console.log(error);
        });
    };

    reader.readAsArrayBuffer(file);
  }; // loadShapeFile

  /// / GEOCODER CONTROL
  const Geocoder = new MapboxGeocoder({
    placeholder: initAddress,
    localGeocoder: coordinatesGeocoder,
    marker: false,
    accessToken: MAPBOX_TOKEN,
    container: map.current,
    proximity: 'ip',
    trackProximity: true,
    countries: 'us',
  });
  geocoderRef.current = Geocoder;

  const deleteFeatures = (gresult) => {
    if (gresult && hasDrawing && drawerRef.current) {
      drawerRef.current.deleteAll();
      setPolygonArea(0);
      setFeatures([]);
    }
  };

  // upon marker move, find the address of this new location and set the state
  useEffect(() => { // lat, lon
    geocodeReverse({
      apiKey: MAPBOX_TOKEN,
      setterFunc: (addr) => {
        setAddress(addr());

        const sb = document.querySelector('.mapboxgl-ctrl-geocoder--input');
        if (sb) {
          sb.value = '';
          sb.placeholder = addr().fullAddress;
        }
      },
      longitude: lon,
      latitude: lat,
    });

    if (hasElevation) {
      // eslint-disable-next-line no-use-before-define
      getElevation(lat, lon);
    }

    if (markerRef.current) {
      const lngLat = [lon, lat];
      markerRef.current.setLngLat(lngLat).setPopup(popupRef.current);
      map.current.setCenter(lngLat);
    }
  }, [lon, lat]);

  useEffect(() => {
    if (
      drawerRef.current
      && features?.length
    ) {
      try {
        drawerRef.current?.deleteAll?.();

        if (Array.isArray(features[0])) {
          features.forEach((f) => {
            drawerRef.current.add({
              type: 'FeatureCollection',
              f,
            });
          });
        } else {
          try {
            features.forEach((feature) => {
              drawerRef.current.add(feature);
            });
          } catch (ee) {
            //
          }
        }

        setPolygonArea(calcArea(features));
      } catch (ee) {
        // only happens when importing shapefile from opening map without setter
      }
    }
  }, [features, drawerRef.current]);

  useEffect(() => {
    if (bounds && map.current) {
      map.current.fitBounds(getBounds(bounds), {
        duration: 0,
        padding: boundsPadding,
      });
    }
  }, [bounds, map.current]);

  useEffect(() => { // map
    // initialize map only once
    if (!map.current) {
      const Map = new mapboxgl.Map({
        accessToken: MAPBOX_TOKEN,
        container: mapContainer.current,
        style: layer,
        center: [lon, lat],
        zoom,
      });
      map.current = Map;

      const Popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(popup(lat, lon));
      popupRef.current = Popup;

      /// / MARKER CONTROL
      const Marker = new mapboxgl.Marker({
        draggable: hasMarkerMovable,
        color: '#e63946',
        scale: 1,
        ...markerOptions,
      }).setLngLat([lon, lat]);

      markerRef.current = Marker;

      Marker.className = styles.marker;

      if (hasMarkerMovable) {
        Marker.setPopup(Popup);
      }

      const simpleSelect = MapboxDraw.modes.simple_select;
      const directSelect = MapboxDraw.modes.direct_select;

      simpleSelect.dragMove = () => {};
      directSelect.dragFeature = () => {};

      // DRAWER CONTROL
      const Draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        modes: {
          ...MapboxDraw.modes,
          simple_select: simpleSelect,
          direct_select: directSelect,
        },
      });
      drawerRef.current = Draw;

      /// / GEOLOCATE CONTROL
      const Geolocate = new mapboxgl.GeolocateControl({ container: map.current });

      /// / NAVIGATION CONTROL
      const Navigation = new mapboxgl.NavigationControl({
        container: map.current,
      });

      /// / FULLSCREEN CONTROL
      const Fullscreen = new mapboxgl.FullscreenControl();

      /// / ADD CONTROLS
      if (hasFullScreen) map.current.addControl(Fullscreen, 'top-right');
      if (hasNavigation) map.current.addControl(Navigation, 'top-right'); // causes warning
      if (hasGeolocate) map.current.addControl(Geolocate, 'top-right');
      if (hasDrawing) map.current.addControl(Draw, 'top-right');
      if (hasSearchBar) map.current.addControl(Geocoder, 'top-left');
      if (hasMarker && !isDrawActive) markerRef.current.addTo(map.current);

      /// / FUNCTIONS
      const handleGeolocate = (e) => {
        const lngLat = e.target._userLocationDotMarker._lngLat;

        setLat(lngLat.lat);
        setLon(lngLat.lng);
        setZoom(map.current.getZoom());
        setBounds(false);
        setPolygonArea(0);
        setFeatures([]);
        if (hasDrawing && drawerRef.current) {
          drawerRef?.current?.deleteAll();
        }
      }; // handleGeolocate

      const handleDrawCreate = (geom) => {
        updateFeatures();

        if (geom.features.length > 0) {
          const coords = turf.centroid(geom.features[0]).geometry.coordinates;

          setLat(coords[1]);
          setLon(coords[0]);
        }

        newPolygon = true;
        setTimeout(() => {
          newPolygon = false;
        }, 100);
      };

      const handleDrawDelete = () => {
        setIsDrawActive(false);
        setTimeout(updateFeatures, 10);
        // updateFeatures();

        document.querySelector('.mapbox-gl-draw_trash').style.display = 'none';
      };

      const showHideTrashcan = (e) => {
        const trashButton = document.querySelector('.mapbox-gl-draw_trash');
        if (e.features.length > 0) {
          trashButton.style.display = 'block';
        } else {
          trashButton.style.display = 'none';
        }
      };

      /// / EVENTS
      Geolocate.on('geolocate', handleGeolocate);

      Geolocate.on('error', (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          alert('Geolocation access denied. Please enable location services.');
        }
      });

      Geocoder.on('result', (e) => {
        if (e?.result?.place_name) {
          deleteFeatures(e.result);
          setLat(e.result.center[1]);
          setLon(e.result.center[0]);
          setZoom(defaultZoom);
          map.current.setZoom(defaultZoom);
          setBounds(false);
        }
      });

      if (hasMarkerMovable) {
        map.current.on('dblclick', (e) => {
          if (newPolygon) return;
          setLat(e.lngLat.lat);
          setLon(e.lngLat.lng);
          setZoom(defaultZoom);
          map.current.setZoom(defaultZoom);
          setBounds(false);
          e.preventDefault();
        });
      }

      map.current.on('dragstart', () => setDragging(true));

      map.current.on('dragend', () => {
        setDragging(false);
        setCursorLoc({
          latitude: null,
          longitude: null,
        });
      });

      map.current.on('mousemove', (e) => {
        const lnglat = e.lngLat.wrap();
        setCursorLoc({
          latitude: lnglat.lat.toFixed(4),
          longitude: lnglat.lng.toFixed(4),
        });

        if (cursorRef.current) {
          cursorRef.current.style.left = `${e.originalEvent.pageX - 58}px`;
          cursorRef.current.style.top = `${e.originalEvent.pageY - 25}px`;
        }
      });

      map.current.on('load', () => {
        const mc = mapContainer.current;
        if (!mc) return;
        setSearchBox(mc.querySelector('.mapboxgl-ctrl-geocoder--input'));

        if (bounds && map.current) {
          map.current.fitBounds(getBounds(bounds), {
            duration: 0,
            padding: boundsPadding,
          });
        }

        if (hasFreehand) {
          mc.querySelector('.mapboxgl-ctrl-group:last-of-type button:first-of-type')
            ?.insertAdjacentHTML(
              'afterend',
              `
                <button
                  id="freehand"
                  style="margin-top: 1px solid #ddd;"
                  title="Freehand tool"
                >
                  <svg id="polygon-tool" class="mapboxgl-ctrl-icon custom-icon" viewBox="0 0 24 24">
                    <path d="M3 10 L8 3 L15 5 L19 12 L12 20 L5 15 Z" stroke="#000" stroke-width="2" fill="none"></path>
                  </svg>
                </button>
              `,
            );

          const freehand = mc.querySelector('#freehand');
          freehand?.addEventListener('click', () => {
            freehand.classList.toggle('active');
            if (freehand.classList.contains('active')) {
              if (hasDrawing) {
                document.querySelector('.mapbox-gl-draw_polygon').style.display = 'none';
                Draw.changeMode('draw_polygon');
              }
              map.current.dragPan.disable();
            } else {
              if (hasDrawing) {
                document.querySelector('.mapbox-gl-draw_polygon').style.display = 'block';
                Draw.changeMode('simple_select');
              }
              map.current.dragPan.enable();
            }
          });
        }

        if (hasImport) {
          mc.querySelector('.mapboxgl-ctrl-group:last-of-type button:last-of-type')
            ?.insertAdjacentHTML(
              'afterend',
              `
                <button
                  id="import"
                  style="font: bold 8pt arial"
                  title="Import a shape file"
                >
                  SHP
                </button>
                <input
                  id="FileUpload"
                  type="file"
                  accept=".shp"
                  style="display: none"
                />
              `,
            );

          const markerEl = mc.querySelector('#import');
          markerEl.addEventListener('click', () => {
            mc.querySelector('#FileUpload').click();
          });

          const upload = mc.querySelector('#FileUpload');
          upload.addEventListener('change', loadShapeFile);
        }

        if (hasHelp) {
          mc.querySelector('.mapboxgl-ctrl-group:last-of-type button:last-of-type')
            ?.insertAdjacentHTML(
              'afterend',
              `
                <button
                  title="Help"
                  onclick="document.querySelector('#MapHelp').showModal();"
                >
                  ?
                </button>
              `,
            );
        }

        if (!scrollZoom) map.current.scrollZoom.disable();
        if (!dragRotate) map.current.dragRotate.disable();
        if (!dragPan) map.current.dragPan.disable();
        if (!keyboard) map.current.keyboard.disable();
        if (!doubleClickZoom) map.current.doubleClickZoom.disable();
        if (!touchZoomRotate) map.current.touchZoomRotate.disable();

        const newLine = () => ({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [],
              },
              properties: {},
            },
          ],
        });

        let lineData = newLine();

        if (hasFreehand) {
          map.current.addSource('line', {
            type: 'geojson',
            data: lineData,
          });

          map.current.addLayer({
            id: 'line-layer',
            type: 'line',
            source: 'line',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#fff',
              'line-width': 3,
            },
          });

          map.current.on('mousedown', (e) => {
            const lnglat = e.lngLat.wrap();
            if (inFreehand()) {
              lineData = newLine();
              lineData.features[0].geometry.coordinates.push([lnglat.lng, lnglat.lat]);
              fpolygon = [[lnglat.lng, lnglat.lat]];
            }
          });

          map.current.on('mousemove', (e) => {
            const lnglat = e.lngLat.wrap();
            if (inFreehand() && fpolygon[0].length) {
              lineData.features[0].geometry.coordinates.push([lnglat.lng, lnglat.lat]);
              map.current.getSource('line').setData(lineData);
              fpolygon.push([lnglat.lng, lnglat.lat]);
            }
          });

          map.current.on('mouseup', () => {
            const id = `freehand${+(new Date())}`;
            if (inFreehand()) {
              const created = fpolygon.length > 1;
              if (created) {
                map.current.addPolygon(
                  id,
                  [fpolygon],
                  {
                    'fill-color': '#f00',
                    'fill-opacity': 0.1,
                    'line-width': 1,
                    'line-color': '#ddd',
                  },
                );
              }

              mc.querySelector('#freehand').classList.toggle('active');

              fpolygon = [[]];
              const { layers } = map.current.getStyle();
              layers.forEach((lay) => {
                if (lay.source === id) {
                  map.current.removeLayer(lay.id);
                }
              });

              const [newLon, newLat] = turf.centroid(lineData.features[0]).geometry.coordinates;
              lineData = newLine();
              map.current.getSource('line').setData(lineData);

              updateFeatures(newLat, newLon);

              if (created) {
                map.current.removeSource(id);
              }

              if (hasDrawing) {
                document.querySelector('.mapbox-gl-draw_polygon').style.display = 'block';
                Draw.changeMode('simple_select');
              }
            }
          });
        }

        map.current.addPolygon = (id, poly, options = {}) => {
          if (typeof poly === 'string') {
            console.log(poly);
            fetch(poly)
              .then((response) => response.json())
              .then((data) => {
                if (data.length) {
                  map.current.addPolygon(id, data[0].polygonarray[0], options);
                } else if (data.polygonarray) { // doesn't work for all hardiness zones !!!
                  map.current.addPolygon(id, data.polygonarray[0], options);
                }
              });
            return;
          }

          const lineId = `${id}-line`;

          const polygonStyle = {
            'fill-color': options['fill-color'] ?? '#000',
            'fill-opacity': options['fill-opacity'] ?? 1,
          };

          const lineStyle = {
            'line-color': options['line-color'] ?? '#000',
            'line-opacity': options['line-opacity'] ?? 1,
            'line-width': options['line-width'] ?? 1,
          };

          if (map.current.getLayer(id)) {
            map.current.removeLayer(id);
          }
          if (map.current.getLayer(lineId)) {
            map.current.removeLayer(lineId);
          }

          if (map.current.getSource(id)) {
            map.current.removeSource(id);
          }

          map.current.addSource(id, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: poly,
              },
            },
          });

          map.current.addLayer({
            id,
            type: 'fill',
            source: id,
            paint: polygonStyle,
          });

          map.current.addLayer({
            id: lineId,
            type: 'line',
            source: id,
            paint: lineStyle,
          });

          map.current.on('mouseenter', id, () => {
            map.current.setPaintProperty(lineId, 'line-width', 2);
            map.current.setPaintProperty(lineId, 'line-color', '#aaa');

            ['fill-color', 'fill-opacity'].forEach((prop) => {
              if (options.hover?.[prop]) {
                map.current.setPaintProperty(id, prop, options.hover[prop]);
              }
            });

            ['line-width', 'line-color', 'line-opacity'].forEach((prop) => {
              if (options.hover?.[prop]) {
                map.current.setPaintProperty(lineId, prop, options.hover[prop]);
              }
            });
          });

          map.current.on('mouseleave', id, () => {
            Object.entries(polygonStyle).forEach(([property, value]) => {
              map.current.setPaintProperty(id, property, value);
            });

            Object.entries(lineStyle).forEach(([property, value]) => {
              map.current.setPaintProperty(lineId, property, value);
            });
          });

          if (options.fitBounds) {
            const boundingBox = turf.bbox({
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: poly,
              },
            });

            map.current.fitBounds(boundingBox, {
              padding: boundsPadding,
              duration: 0,
            });

            map.current.on('resize', () => {
              map.current.fitBounds(boundingBox, {
                padding: boundsPadding,
                duration: 0,
              });
            });
          }
        };

        setMap(map.current);
      });

      map.current.on('draw.create', handleDrawCreate);
      map.current.on('draw.delete', handleDrawDelete);
      map.current.on('draw.selectionchange', showHideTrashcan);

      map.current.on('zoom', (event) => {
        if (!event.originalEvent) return;
        setZoom(map.current.getZoom());
        setBounds(false);
      });

      if (features?.[0] && (fitMapToPolygons || fitBounds)) {
        const mergedFeatures = {
          type: 'FeatureCollection',
          features: [],
        };

        features.forEach((item) => {
          if (item.type === 'FeatureCollection') {
            mergedFeatures.features.push(...item.features);
          } else if (item.type === 'Feature') {
            mergedFeatures.features.push(item);
          }
        });

        const boundingBox = turf.bbox(mergedFeatures);
        const [minLon, minLat, maxLon, maxLat] = boundingBox;

        if (fitMapToPolygons) {
          const ratio = ((maxLon - minLon) / (maxLat - minLat));
          const aspectRatio = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
          if (initHeight || !initWidth) {
            const height = map.current.getContainer().clientHeight;
            const width = height * ratio * aspectRatio;
            map.current.getContainer().style.width = `${width}px`;
            map.current.getContainer().parentNode.style.width = `${width}px`;
          } else {
            const width = map.current.getContainer().clientWidth;
            const height = width / (ratio * aspectRatio);
            map.current.getContainer().style.height = `${height}px`;
            map.current.getContainer().parentNodestyle.height = `${height}px`;
          }
          map.current.resize();
        }

        requestAnimationFrame(() => {
          map.current.fitBounds(boundingBox, { padding: boundsPadding, duration: 0 });
        });
      }
    }
  }, [map]);

  const getElevation = async () => {
    const latLon = `${(+lat).toFixed(4)} ${(+lon).toFixed(4)}`;
    if (!elevations[latLon] && elevations[latLon] !== '...') {
      elevations[latLon] = '...';
      elevations[latLon] = (await (
        await fetch(`https://weather.covercrop-data.org/elevation?lat=${lat}&lon=${lon}`)
      )?.json())?.elevation;
      elevations[latLon] = (elevations[latLon] * 3.281).toFixed(0) || '...';
    }
    setElevation(elevations[latLon]);
  }; // getElevation

  return (
    <div
      className={`mapbox ${styles.wrapper} ${hasClear ? 'hasclear' : ''}`}
      style={{ width: initWidth || '100%', height: initHeight || '100%' }}
    >
      {
        hasHelp
          ? (
            <Help
              hasMarkerMovable={hasMarkerMovable}
              hasFullscreen={hasFullScreen}
              hasFreehand={hasFreehand}
              hasImport={hasImport}
              otherHelp={otherHelp}
            />
          )
          : null
      }
      <div
        id="psa-map"
        ref={mapContainer}
        className={styles.map}
        style={{ width: initWidth || '100%', height: initHeight || '100%' }}
      />
      {hasCoordBar && (
        <div className={styles.infobar}>
          <div>
            Latitude:&nbsp;&nbsp;
            {lat.toFixed(4)}
          </div>
          <div>
            Longitude:
            {lon.toFixed(4)}
          </div>
          {
            +elevation
              ? <div>{`Elevation: ${elevation} feet`}</div>
              : null
          }
          {
            +polygonArea
              ? <div>{`Area: ${(+polygonArea).toFixed(2)} acres`}</div>
              : null
          }
          <div className="cursor" ref={cursorRef}>
            {
              cursorLoc.latitude && !dragging
                ? `${cursorLoc.latitude},${cursorLoc.longitude}`
                : null
            }
          </div>

          {
            showZoom
              ? <div>{zoom}</div>
              : null
          }
        </div>
      )}
    </div>
  );
};

export default ReduxMap;
