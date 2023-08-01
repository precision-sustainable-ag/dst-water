/* eslint-disable no-underscore-dangle */
import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import mapboxgl from 'mapbox-gl'; // eslint-disable-line import/no-webpack-loader-syntax
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import area from '@turf/area';
import centroid from '@turf/centroid';
import { geocodeReverse, coordinatesGeocoder } from './helpers';

import styles from './map.module.scss';
import './mapbox-gl.css';
import './mapbox-gl-draw.css';
import './mapbox-gl-geocoder.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoibWlsYWRueXUiLCJhIjoiY2xhNmhkZDVwMWxqODN4bWhkYXFnNjRrMCJ9.VWy3AxJ3ULhYNw8nmVdMew';
mapboxgl.accessToken = MAPBOX_TOKEN;

const acreDiv = 4046.856422;
const fastFly = {
  bearing: 0,
  speed: 4, // Make the flying slow/fast.
  curve: 5, // Change the speed at which it zooms out.
  easing: (t) => t ** 2,
};

const ReduxMap = ({
  getters = {},
  setters = {},
  setMap = () => {},
  initWidth = '400px',
  initHeight = '400px',
  initFeatures = [],
  mapLocation = getters.map ? useSelector(getters.map) : { lat: 40, lon: -75, address: { fullAddress: '' } },
  initAddress = mapLocation.address?.fullAddress || '',
  initLon = mapLocation.lon,
  initLat = mapLocation.lat,
  initStartZoom = getters.mapFeatures ? useSelector(getters.mapFeatures.zoom) : 12,
  hasSearchBar = false,
  hasMarker = false,
  hasNavigation = false,
  hasCoordBar = false,
  hasDrawing = false,
  hasGeolocate = false,
  hasFullScreen = false,
  hasMarkerMovable = false,
  scrollZoom = true,
  dragRotate = true,
  dragPan = true,
  keyboard = true,
  doubleClickZoom = false,
  touchZoomRotate = true,
  markerOptions = {},
  autoFocus = false,
  layer = 'mapbox://styles/mapbox/satellite-streets-v12',
  bounds = false,
}) => {
  const dispatch = useDispatch();

  let newPolygon;

  const updateLocation = (addr, marker) => {
    if (setters.map) {
      dispatch(setters.map({
        address: addr(),
        lat: marker.latitude,
        lon: marker.longitude,
      }));
    }
  }; // updateLocation

  const [marker, setMarker] = useState({
    longitude: initLon,
    latitude: initLat,
  });

  const [cursorLoc, setCursorLoc] = useState({
    longitude: undefined,
    latitude: undefined,
  });
  const [featuresInitialized, setFeaturesInitialized] = useState(false);
  const [polygonArea, setPolygonArea] = useState(0);
  const [isDrawActive, setIsDrawActive] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState(undefined);
  const [flyToOptions, setFlyToOptions] = useState({});

  const map = useRef();
  const mapContainer = useRef();
  const drawerRef = useRef();
  const markerRef = useRef();
  const popupRef = useRef();
  const geocoderRef = useRef();

  const searchBox = map.current?.getContainer().querySelector('.mapboxgl-ctrl-geocoder--input');

  if (searchBox && autoFocus) {
    searchBox.focus();
  }

  useEffect(() => {
    setMarker({
      longitude: initLon,
      latitude: initLat,
    });
  }, [initLon, initLat]);

  /// / GEOCODER CONTROL
  const Geocoder = new MapboxGeocoder({
    placeholder: (initAddress || 'Search Your Address ...'),
    localGeocoder: coordinatesGeocoder,
    marker: false,
    accessToken: MAPBOX_TOKEN,
    container: map.current,
    proximity: 'ip',
    trackProximity: true,
    countries: 'us',
  });
  geocoderRef.current = Geocoder;

  // handle empty initFeature
  useEffect(() => {
    if (hasDrawing && drawerRef.current && initFeatures.length) {
      drawerRef.current.add({
        type: 'FeatureCollection',
        features: initFeatures,
      });
    }
  }, [initFeatures]);

  // delete all shapes after geocode search
  useEffect(() => {
    if (hasDrawing && drawerRef.current) {
      drawerRef.current.deleteAll();
      setPolygonArea(0);
    }
  }, [geocodeResult]);

  // upon marker move, find the address of this new location and set the state
  useEffect(() => {
    geocodeReverse({
      apiKey: MAPBOX_TOKEN,
      setterFunc: (address) => {
        if (searchBox) {
          searchBox.placeholder = address().fullAddress;
        }

        updateLocation(address, marker);
      },
      longitude: marker.longitude,
      latitude: marker.latitude,
    });

    if (markerRef.current) {
      const lngLat = [marker.longitude, marker.latitude];
      markerRef.current.setLngLat(lngLat).setPopup(popupRef.current);
      map.current.flyTo({
        center: lngLat,
        ...flyToOptions,
      });
    }
  }, [marker.longitude, marker.latitude]);

  useEffect(() => {
    /// / MAP CREATE
    if (map.current) return; // initialize map only once
    const Map = new mapboxgl.Map({
      container: mapContainer.current,
      style: layer,
      center: [initLon, initLat],
      zoom: initStartZoom,
    });
    map.current = Map;

    const Popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
      <div style="background: #eee; text-align: center">Click to drag</div>
      ${marker.longitude.toFixed(4)}  ${marker.latitude.toFixed(4)}
    `);
    popupRef.current = Popup;

    /// / MARKER CONTROL
    const Marker = new mapboxgl.Marker({
      draggable: hasMarkerMovable,
      color: '#e63946',
      scale: 1,
      ...markerOptions,
    })
      .setLngLat([marker.longitude, marker.latitude]);

    markerRef.current = Marker;

    Marker.className = styles.marker;

    let isDragging = false;

    if (hasMarkerMovable) {
      Marker.setPopup(Popup);

      // show Popup on hover
      Marker.getElement().addEventListener('mouseenter', () => {
        if (!isDragging) {
          Marker.togglePopup();
        }
      });

      // hide Popup when not hovering over marker
      Marker.getElement().addEventListener('mouseleave', () => {
        if (!isDragging) {
          Marker.togglePopup();
        }
      });

      // update Popup content while marker is being dragged
      Marker.on('drag', () => {
        Marker.getPopup().setHTML(`
          <div style="background: #eee; text-align: center">Click to drag</div>
          ${Marker.getLngLat().lng.toFixed(4)}  ${Marker.getLngLat().lat.toFixed(4)}
        `);
      });

      Marker.on('dragstart', () => { isDragging = true; });
      Marker.on('dragend', () => { isDragging = false; });
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
    const Fullscreen = new mapboxgl.FullscreenControl({
      container: map.current,
    });

    /// / ADD CONTROLS
    if (hasFullScreen) map.current.addControl(Fullscreen, 'top-right');
    if (hasNavigation) map.current.addControl(Navigation, 'top-right');
    if (hasGeolocate) map.current.addControl(Geolocate, 'top-right');
    if (hasDrawing) map.current.addControl(Draw, 'top-left');
    if (hasSearchBar) map.current.addControl(Geocoder, 'top-left');
    if (hasMarker && !isDrawActive) Marker.addTo(map.current);

    /// / FUNCTIONS
    function onDragEnd(e) {
      const lngLat = e.target.getLngLat();
      // map.current.flyTo({
      //   center: lngLat,
      // });
      setMarker((prev) => ({
        ...prev,
        longitude: lngLat.lng,
        latitude: lngLat.lat,
      }));
    }

    const handleGeolocate = (e) => {
      const lngLat = e.target._userLocationDotMarker._lngLat;
      setFlyToOptions(fastFly);

      setMarker((prev) => ({
        ...prev,
        longitude: lngLat.lng,
        latitude: lngLat.lat,
      }));
      setFlyToOptions({});

      // clear all shapes after geolocating to user's location
      if (hasDrawing && drawerRef.current) {
        drawerRef.current.deleteAll();
        setPolygonArea(0);
        if (setters?.mapFeatures?.area) {
          dispatch(setters.mapFeatures.area(0));
        }
      }
    };

    const handlePolyCentCalc = (geom) => {
      if (geom) {
        if (geom.features.length > 0) {
          const coords = centroid(geom.features[0]).geometry.coordinates;

          setMarker((prev) => ({
            ...prev,
            longitude: coords[0],
            latitude: coords[1],
          }));
        }
      }
    };

    const handlePolyAreaCalc = (e) => {
      let totalArea = 0;
      const { sources } = map.current.getStyle();

      Object.keys(sources).forEach((sourceName) => {
        const source = map.current.getSource(sourceName);
        if (source.type === 'geojson') {
          const { features } = source._data;
          features.forEach((feature) => {
            totalArea += area(feature) / acreDiv;
          });
        }
      });

      setPolygonArea(totalArea);

      if (setters?.mapFeatures?.area) {
        dispatch(setters.mapFeatures.area(totalArea.toFixed(2)));
      }

      handlePolyCentCalc(e);
    };

    const handleDrawCreate = () => {
      newPolygon = true;
      setTimeout(() => {
        newPolygon = false;
      }, 100);
    };

    const handleDrawDelete = (e) => {
      setIsDrawActive(false);
      handlePolyAreaCalc(e);

      document.querySelector('.mapbox-gl-draw_trash').style.display = 'none';
    };

    const handleDrawUpdate = (e) => {
      handlePolyAreaCalc(e);
    };

    const showHideTrashcan = (e) => {
      const selectedFeatures = e.features;
      const trashButton = document.querySelector('.mapbox-gl-draw_trash');
      if (selectedFeatures.length > 0) {
        trashButton.style.display = 'block';
      } else {
        trashButton.style.display = 'none';
      }
    };

    const handleDrawSelection = (e) => {
      showHideTrashcan(e);
      handlePolyAreaCalc(e);
    };

    /// / EVENTS
    Geolocate.on('geolocate', handleGeolocate);

    Geolocate.on('error', (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        alert('Geolocation access denied. Please enable location services.');
      }
    });

    Geocoder.on('result', (e) => {
      if (e && e.result) {
        setGeocodeResult(e.result);
        const fullAddress = e.result.place_name;
        if (fullAddress.includes('Lat') && fullAddress.includes('Lng')) {
          const longitude = e.result.geometry.coordinates[0];
          const latitude = e.result.geometry.coordinates[1];
          geocodeReverse({
            apiKey: MAPBOX_TOKEN,
            setterFunc: (address) => {
              document.querySelector('.mapboxgl-ctrl-geocoder--input').placeholder = address().fullAddress;
              updateLocation(address, { longitude, latitude });
            },
            longitude,
            latitude,
          });
        }

        if (fullAddress) {
          setFlyToOptions(fastFly);

          setMarker((prev) => ({
            ...prev,
            longitude: e.result.center[0],
            latitude: e.result.center[1],
          }));
          setFlyToOptions({});
        }
      }
    });

    if (hasMarkerMovable) {
      map.current.on('dblclick', (e) => {
        if (newPolygon) return;
        setMarker((prev) => ({
          ...prev,
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
        }));
        e.preventDefault(); // doubleClickZoom.disable() doesn't seem to work
      });
    }

    map.current.on('mousemove', (e) => {
      const lnglat = e.lngLat.wrap();
      setCursorLoc({
        longitude: lnglat.lng.toFixed(4),
        latitude: lnglat.lat.toFixed(4),
      });
    });

    map.current.on('load', () => {
      if (bounds) {
        map.current.fitBounds(bounds);
      }

      if (!scrollZoom) map.current.scrollZoom.disable();
      if (!dragRotate) map.current.dragRotate.disable();
      if (!dragPan) map.current.dragPan.disable();
      if (!keyboard) map.current.keyboard.disable();
      if (!doubleClickZoom) map.current.doubleClickZoom.disable();
      if (!touchZoomRotate) map.current.touchZoomRotate.disable();

      if (
        drawerRef.current
        && hasDrawing
        && initFeatures.length > 0
        && !featuresInitialized
      ) {
        drawerRef.current.add({
          type: 'FeatureCollection',
          features: initFeatures,
        });
        setFeaturesInitialized(true);
      }

      map.current.addPolygon = (id, polygon, options = {}) => {
        if (typeof polygon === 'string') {
          fetch(polygon)
            .then((response) => response.json())
            .then((data) => {
              if (data.length) {
                map.current.addPolygon(id, data[0].polygonarray[0], options);
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
              coordinates: polygon,
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
          let overallBounds = null;
          polygon.forEach((p) => {
            const newBounds = p.reduce((bounds1, coord) => (
              bounds1.extend(coord)
            ), new mapboxgl.LngLatBounds(p[0], p[0]));

            if (overallBounds) {
              overallBounds = overallBounds.extend(newBounds);
            } else {
              overallBounds = newBounds;
            }
          });

          map.current.fitBounds(overallBounds, {
            padding: 20,
          });

          map.current.on('resize', () => {
            map.current.fitBounds(overallBounds, {
              padding: 20,
            });
          });
        }
      };

      setMap(map.current);
    });

    map.current.on('draw.create', handleDrawCreate);
    map.current.on('draw.delete', handleDrawDelete);
    map.current.on('draw.update', handleDrawUpdate);
    map.current.on('draw.selectionchange', handleDrawSelection);

    map.current.on('zoom', () => {
      const currentZoom = map.current.getZoom();
      if (setters?.mapFeatures?.zoom) {
        dispatch(setters.mapFeatures.zoom(currentZoom));
      }
    });

    Marker.on('dragend', onDragEnd);
  }, [map]);

  return (
    <div className={styles.wrapper}>
      <div
        id="map"
        ref={mapContainer}
        className={styles.map}
        style={{ width: initWidth, height: initHeight }}
      />
      {hasCoordBar && cursorLoc.longitude && (
        <div className={styles.infobar}>
          <div>{`Longitude:${cursorLoc.longitude}`}</div>
          <div>{`Latitude:${cursorLoc.latitude}`}</div>
          {polygonArea > 0 && (
            <div>{`Area: ${polygonArea.toFixed(2)} acres`}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReduxMap;
