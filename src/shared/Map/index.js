import React, { useState, useEffect } from 'react';
import { Map } from '@psa/dst.ui.map';
import { useSelector, useDispatch } from 'react-redux';
import mapboxgl from 'mapbox-gl';
import { get, set } from '../../store/Store';
import './styles.scss';
// eslint-disable-next-line import/no-webpack-loader-syntax, import/no-unresolved
mapboxgl.workerClass = require('worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker').default;

let removedShapes = new Set();

const MapComp = () => {
  const [address, setAddress] = useState({});
  const [zoom, setZoom] = useState(null);
  const dispatch = useDispatch();
  const lat = useSelector(get.lat);
  const lon = useSelector(get.lon);
  const mapAddress = useSelector(get.mapAddress);
  const mapZoom = useSelector(get.mapZoom);
  const mapPolygon = useSelector(get.mapPolygon);
  const [features, setFeatures] = useState(mapPolygon);
  const [drawEvent, setDrawEvent] = useState({});
  // const [removedShapes, setRemovedShapes] = useState(new Set());
  // mapAddress
  useEffect(() => {
    if (drawEvent.mode === 'delete') {
      removedShapes = removedShapes.add(drawEvent.e.features[0].id);
    }
    const ids = new Set(mapPolygon.map((d) => d.id));
    const merged = [
      ...mapPolygon.filter((d) => !removedShapes.has(d.id)),
      ...features.filter((d) => !ids.has(d.id) && !removedShapes.has(d.id)),
    ];
    dispatch(set.mapPolygon(merged));
  }, [dispatch]);

  useEffect(() => {
    dispatch(set.mapType('satellite'));
    if (address.latitude) dispatch(set.lat(address.latitude));
    if (address.longitude) dispatch(set.lon(address.longitude));
    if (address.address) dispatch(set.mapAddress(address.address));
  }, [address, dispatch]);

  useEffect(() => {
    if (zoom) dispatch(set.mapZoom(zoom));
  }, [zoom]);

  return (
    <div className="map">
      <Map
        setAddress={setAddress}
        setFeatures={setFeatures}
        setZoom={setZoom}
        onDraw={setDrawEvent}
        initFeatures={mapPolygon}
        initWidth="100%"
        initHeight="400px"
        initAddress={mapAddress?.address}
        initLon={lon}
        initLat={lat}
        initStartZoom={mapZoom}
        initMinZoom={5}
        initMaxZoom={16}
        hasSearchBar
        hasMarker
        hasNavigation
        hasCoordBar
        hasDrawing
        hasGeolocate
        hasFullScreen
        hasMarkerPopup
        hasMarkerMovable
      />
    </div>
  );
};

export default MapComp;
