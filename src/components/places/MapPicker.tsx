import React, { useMemo, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { Text } from '@/components/ui/Text'
import { radius, smoothCorner, space } from '@/theme/tokens'
import { useTheme } from '@/theme/ThemeProvider'

export interface MapMarker {
  lat: number
  lon: number
  title?: string
  /** The one currently chosen; drawn in the accent colour. */
  selected?: boolean
}

interface Props {
  lat: number
  lon: number
  markers?: MapMarker[]
  onPick: (lat: number, lon: number) => void
  height?: number
  hint?: string
}

/**
 * The map for placing a pin exactly.
 *
 * OpenStreetMap through a WebView, deliberately, instead of the native Google/Apple map.
 * The Android Maps SDK needs an API key tied to a billing account, and — worse — it does not
 * degrade without one: it takes the whole process down, which is a native crash no React
 * error boundary can catch. That made a keyless build actively dangerous rather than merely
 * limited. OpenStreetMap tiles need no key, no account and no card, so the map now works for
 * anyone who builds this.
 *
 * The map is still an enhancement, never a requirement: a place can always be set with
 * "I am here now" (GPS, no network) or by searching for it.
 *
 * Everything is inlined into the page — no remote script, no analytics, nothing that could
 * identify anyone. The only outbound requests are for the tile images themselves.
 */
export function MapPicker({ lat, lon, markers, onPick, height = 280, hint }: Props) {
  const { colors: c, scheme } = useTheme()
  const webRef = useRef<WebView>(null)

  const pins = useMemo(
    () => (markers?.length ? markers : [{ lat, lon, selected: true }]),
    [markers, lat, lon],
  )

  const html = useMemo(
    () => buildMapHtml({ lat, lon, pins, accent: c.accent, muted: c.inkFaint, dark: scheme === 'dark' }),
    [lat, lon, pins, c.accent, c.inkFaint, scheme],
  )

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { lat?: number; lon?: number }
      if (typeof data.lat === 'number' && typeof data.lon === 'number') {
        onPick(data.lat, data.lon)
      }
    } catch {
      // A malformed message means a tap produced nothing usable; ignore it rather than crash.
    }
  }

  return (
    <View style={[styles.shell, { height, backgroundColor: c.canvasDeep }]}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={styles.web}
        onMessage={handleMessage}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        // Nothing in the page needs to remember anything about the viewer.
        thirdPartyCookiesEnabled={false}
        scrollEnabled={false}
        overScrollMode="never"
        androidLayerType="hardware"
      />
      <View style={[styles.hint, { backgroundColor: c.surface }]} pointerEvents="none">
        <Text variant="caption" tone="muted">{hint ?? 'Tap the map to move the pin'}</Text>
      </View>
    </View>
  )
}

/**
 * The map page.
 *
 * Hand-written rather than using Leaflet so nothing is fetched but the tiles themselves: a
 * map library from a CDN would be a second remote dependency, a second thing to break
 * offline, and a second party who learns the app was opened.
 */
function buildMapHtml(opts: {
  lat: number
  lon: number
  pins: MapMarker[]
  accent: string
  muted: string
  dark: boolean
}): string {
  const { lat, lon, pins, accent, muted, dark } = opts

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body { margin:0; padding:0; height:100%; overflow:hidden;
              background:${dark ? '#0C0F14' : '#E5E9F3'}; }
  #map { position:absolute; inset:0; touch-action:none; }
  .tile { position:absolute; width:256px; height:256px;
          ${dark ? 'filter:invert(1) hue-rotate(180deg) brightness(0.85) contrast(1.1);' : ''} }
  .pin { position:absolute; width:22px; height:22px; margin:-11px 0 0 -11px;
         border-radius:50%; border:3px solid #fff; box-sizing:border-box;
         box-shadow:0 1px 4px rgba(0,0,0,.4); }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function () {
  var ZOOM = 15, TILE = 256;
  var centre = { lat: ${lat}, lon: ${lon} };
  var pins = ${JSON.stringify(pins)};
  var map = document.getElementById('map');

  // Web Mercator, the projection every slippy-map tile server uses.
  function lonToX(lon, z) { return (lon + 180) / 360 * Math.pow(2, z) * TILE; }
  function latToY(lat, z) {
    var s = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z) * TILE;
  }
  function xToLon(x, z) { return x / (Math.pow(2, z) * TILE) * 360 - 180; }
  function yToLat(y, z) {
    var n = Math.PI - 2 * Math.PI * y / (Math.pow(2, z) * TILE);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  function render() {
    var w = map.clientWidth, h = map.clientHeight;
    var cx = lonToX(centre.lon, ZOOM), cy = latToY(centre.lat, ZOOM);
    var left = cx - w / 2, top = cy - h / 2;
    map.innerHTML = '';

    // One extra tile each way so panning never shows a bare edge.
    var x0 = Math.floor(left / TILE), x1 = Math.floor((left + w) / TILE);
    var y0 = Math.floor(top / TILE), y1 = Math.floor((top + h) / TILE);
    var max = Math.pow(2, ZOOM);

    for (var x = x0; x <= x1; x++) {
      for (var y = y0; y <= y1; y++) {
        if (y < 0 || y >= max) continue;
        var tx = ((x % max) + max) % max;
        var img = document.createElement('img');
        img.className = 'tile';
        img.src = 'https://tile.openstreetmap.org/' + ZOOM + '/' + tx + '/' + y + '.png';
        img.style.left = (x * TILE - left) + 'px';
        img.style.top = (y * TILE - top) + 'px';
        img.onerror = function () { this.style.visibility = 'hidden'; };
        map.appendChild(img);
      }
    }

    pins.forEach(function (p) {
      var el = document.createElement('div');
      el.className = 'pin';
      el.style.background = p.selected ? '${accent}' : '${muted}';
      el.style.left = (lonToX(p.lon, ZOOM) - left) + 'px';
      el.style.top = (latToY(p.lat, ZOOM) - top) + 'px';
      map.appendChild(el);
    });
  }

  map.addEventListener('click', function (e) {
    var w = map.clientWidth, h = map.clientHeight;
    var left = lonToX(centre.lon, ZOOM) - w / 2;
    var top = latToY(centre.lat, ZOOM) - h / 2;
    var lonAt = xToLon(left + e.clientX, ZOOM);
    var latAt = yToLat(top + e.clientY, ZOOM);
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latAt, lon: lonAt }));
  });

  render();
  window.addEventListener('resize', render);
})();
</script>
</body>
</html>`
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.card,
    overflow: 'hidden',
    marginBottom: space.lg,
    ...smoothCorner,
  },
  web: { flex: 1, backgroundColor: 'transparent' },
  hint: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
})
