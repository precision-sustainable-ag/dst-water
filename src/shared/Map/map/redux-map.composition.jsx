import React from "react";
import ReduxMap from "./redux-map";

var featuresSample = [
  {
    type: "Feature",
    geometry: {
      coordinates: [
        [
          [-80.12590347289976, 37.782425773494836],
          [-80.09037246704036, 37.790022979308205],
          [-80.06067214965797, 37.74062718302841],
          [-80.09569107055624, 37.74117017324208],
          [-80.12727676391549, 37.75311495017202],
          [-80.12590347289976, 37.782425773494836],
        ],
      ],
      type: "Polygon",
    },
  },
  {
    type: "Feature",
    geometry: {
      coordinates: [
        [
          [-80.2452403254797, 37.77489071424286],
          [-80.24785644332641, 37.75586412843647],
          [-80.23111328910737, 37.74593527108064],
          [-80.19187152140672, 37.73393612436084],
          [-80.18193027358929, 37.76082805750093],
          [-80.18088382645068, 37.800114071409865],
          [-80.2452403254797, 37.77489071424286],
        ],
      ],
      type: "Polygon",
    },
  },
];

export const PlainMapWithoutFeatures = () => (
  <NcalcMap
    setAddress={() => {}}
    setFeatures={() => {}}
    setZoom = {() => {}}
    setMap = {() => {}}
    onDraw = {() => {}}
    initWidth="400px"
    initHeight="300px"
    initLon={-80.16}
    initLat={37.75}
    initStartZoom={10}
    initMinZoom={5}
    initMaxZoom={16}
    hasSearchBar={false}
    hasMarker={false}
    hasNavigation={false}
    hasCoordBar={false}
    hasDrawing={false}
    hasGeolocate={false}
    hasFullScreen={false}
    hasMarkerPopup={false}
    hasMarkerMovable={false}
    scrollZoom={true}
    dragRotate={true}
    dragPan={true}
    keyboard={true}
    doubleClickZoom={false}
    touchZoomRotate={true}
  />
);

export const MapWithMarker = () => (
  <NcalcMap
    setAddress={() => {}}
    setFeatures={() => {}}
    setZoom = {() => {}}
    setMap = {() => {}}
    onDraw = {() => {}}
    initWidth="400px"
    initHeight="300px"
    initLon={-80.16}
    initLat={37.75}
    initStartZoom={10}
    initMinZoom={5}
    initMaxZoom={16}
    hasSearchBar={false}
    hasMarker={true}
    hasNavigation={false}
    hasCoordBar={false}
    hasDrawing={false}
    hasGeolocate={false}
    hasFullScreen={false}
    hasMarkerPopup={true}
    hasMarkerMovable={true}
    scrollZoom={true}
    dragRotate={true}
    dragPan={true}
    keyboard={true}
    doubleClickZoom={false}
    touchZoomRotate={true}
  />
);

export const MapWithGeocoder = () => (
  <NcalcMap
    setAddress={() => {}}
    setFeatures={() => {}}
    setZoom = {() => {}}
    setMap = {() => {}}
    onDraw = {() => {}}
    initWidth="400px"
    initHeight="300px"
    initLon={-80.16}
    initLat={37.75}
    initStartZoom={10}
    initMinZoom={5}
    initMaxZoom={16}
    hasSearchBar={true}
    hasMarker={false}
    hasNavigation={false}
    hasCoordBar={false}
    hasDrawing={false}
    hasGeolocate={false}
    hasFullScreen={false}
    hasMarkerPopup={false}
    hasMarkerMovable={false}
    scrollZoom={true}
    dragRotate={true}
    dragPan={true}
    keyboard={true}
    doubleClickZoom={false}
    touchZoomRotate={true}
  />
);

export const MapWithAllFeatures = () => (
  <NcalcMap
    setAddress={() => {}}
    setFeatures={() => {}}
    setZoom = {() => {}}
    setMap = {() => {}}
    onDraw = {() => {}}
    initFeatures={featuresSample}
    initWidth="400px"
    initHeight="300px"
    initAddress=""
    initLon={-80.16}
    initLat={37.75}
    initStartZoom={10}
    initMinZoom={5}
    initMaxZoom={16}
    hasSearchBar={true}
    hasMarker={true}
    hasNavigation={true}
    hasCoordBar={true}
    hasDrawing={true}
    hasGeolocate={true}
    hasFullScreen={true}
    hasMarkerPopup={true}
    hasMarkerMovable={true}
    scrollZoom={true}
    dragRotate={true}
    dragPan={true}
    keyboard={true}
    doubleClickZoom={false}
    touchZoomRotate={true}
  />
);
