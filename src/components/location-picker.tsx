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
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
};

function mapHtml(lat: number, lng: number): string {
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
      var map = L.map('map').setView([${lat}, ${lng}], 17);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);

      marker.on('dragend', function () {
        var p = marker.getLatLng();
        send('move', { latitude: p.lat, longitude: p.lng });
      });

      // Tapping is easier than dragging one-handed at the roadside, so both work.
      map.on('click', function (e) {
        marker.setLatLng(e.latlng);
        send('move', { latitude: e.latlng.lat, longitude: e.latlng.lng });
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

  // Built once from the first fix. Rebuilding it on every drag would reload the
  // WebView mid-gesture and throw the pin back to where it started.
  const html = useMemo(() => mapHtml(latitude, longitude), []); // eslint-disable-line react-hooks/exhaustive-deps

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
