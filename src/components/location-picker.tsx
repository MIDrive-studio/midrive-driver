import { useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { WebView } from "react-native-webview";

// A draggable pin on a real map, because "somewhere near this postcode" is not
// good enough for an insurance claim -- the junction, lane or car park entrance
// matters, and the GPS fix alone can be tens of metres out or land on the wrong
// side of a dual carriageway.
//
// Leaflet in a WebView rather than react-native-maps: react-native-maps on
// Android needs a Google Maps API key for any build outside Expo Go, whereas
// OpenStreetMap tiles need no key or account at all. It also matches the admin
// Live Map, so both ends of this feature render the same way.

type Props = {
  // Null until a fix arrives, or forever if permission was refused. The map is
  // shown either way: a driver who declined location still has to be able to
  // say where the accident was, and they know the road better than the phone.
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
};

// Roughly the centre of Great Britain, at a zoom that shows the whole country.
// Only used when there is no fix to centre on, purely so the map has somewhere
// to start before the driver pans to the spot.
const FALLBACK = { lat: 54.0, lng: -2.0, zoom: 5 };

function mapHtml(lat: number, lng: number, zoom: number, withPin: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    function send(type, payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload)));
      }
    }

    try {
      var map = L.map('map').setView([${lat}, ${lng}], ${zoom});

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      var marker = null;

      function placeMarker(latlng) {
        if (marker) {
          marker.setLatLng(latlng);
        } else {
          marker = L.marker(latlng, { draggable: true }).addTo(map);
          marker.on('dragend', function () {
            var p = marker.getLatLng();
            send('move', { latitude: p.lat, longitude: p.lng });
          });
        }
        send('move', { latitude: latlng.lat, longitude: latlng.lng });
      }

      if (${withPin ? "true" : "false"}) {
        placeMarker(L.latLng(${lat}, ${lng}));
      }

      // Tapping is easier than dragging one-handed at the roadside, so both
      // work -- and with no fix, tapping is how the pin gets placed at all.
      map.on('click', function (e) {
        placeMarker(e.latlng);
      });

      send('ready', {});
    } catch (err) {
      send('error', { message: String(err) });
    }
  </script>
</body>
</html>`;
}

export function LocationPicker({ latitude, longitude, onChange }: Props) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Rebuilt only when a fix first arrives, never on every drag -- reloading the
  // WebView mid-gesture would throw the pin back to where it started.
  const hasFix = latitude != null && longitude != null;
  const html = useMemo(
    () =>
      hasFix
        ? mapHtml(latitude as number, longitude as number, 17, true)
        : mapHtml(FALLBACK.lat, FALLBACK.lng, FALLBACK.zoom, false),
    [hasFix] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (failed) {
    return (
      <View className="items-center justify-center rounded-lg border border-slate-200 bg-slate-100 p-4" style={{ height: 260 }}>
        <Text className="text-center text-xs text-slate-500">
          The map couldn&apos;t load — you may have no signal here. Your captured coordinates are still recorded, and
          you can add an address below.
        </Text>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-lg border border-slate-200" style={{ height: 260 }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ flex: 1 }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === "move") onChange(message.latitude, message.longitude);
            if (message.type === "ready") setReady(true);
            if (message.type === "error") setFailed(true);
          } catch {
            // A message we don't understand is not worth breaking the picker for.
          }
        }}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
      />

      {!ready && (
        <View className="absolute inset-0 items-center justify-center bg-slate-100">
          <ActivityIndicator />
          <Text className="mt-2 text-xs text-slate-500">Loading map...</Text>
        </View>
      )}
    </View>
  );
}
