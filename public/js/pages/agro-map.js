let map;
let leadsLayer;
let clientsLayer;
let clientMarkers = {};

// Simple colored icons for leads and clients so each type is easily
// distinguishable on the map.
const leadIcon =
  typeof L !== 'undefined'
    ? L.divIcon({
        className: 'lead-marker',
        html:
          '<div style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:2px solid #fff"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 16],
        popupAnchor: [0, -16],
      })
    : null;

const clientIcon =
  typeof L !== 'undefined'
    ? L.divIcon({
        className: 'client-marker',
        html:
          '<div style="background:#16a34a;width:16px;height:16px;border-radius:50%;border:2px solid #fff"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 16],
        popupAnchor: [0, -16],
      })
    : null;

export function initAgroMap() {
  const el = document.getElementById('agroMap');
  if (!el) return null;
  if (typeof L === 'undefined') {
    el.textContent = 'Mapa indisponível';
    return null;
  }
  map = L.map(el).setView([0,0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);
  leadsLayer = L.layerGroup().addTo(map);
  clientsLayer = L.layerGroup().addTo(map);
  return map;
}

export function setMapCenter(lat, lng, zoom=14) {
  if (map) map.setView([lat,lng], zoom);
}

export function plotLeads(leads) {
  if (!map || typeof L === 'undefined' || !leadsLayer) return;
  leadsLayer.clearLayers();
  leads
    .filter((l) => l.stage !== 'Convertido' && l.lat && l.lng)
    .forEach((l) => {
      const marker = L.marker([l.lat, l.lng], {
        title: l.name || 'Lead',
        icon: leadIcon || undefined,
      }).addTo(leadsLayer);
      const loc = l.farmName || `(${l.lat.toFixed(4)}, ${l.lng.toFixed(4)})`;
      const interest = l.interest ? `<br>Interesse: ${l.interest}` : '';
      marker.bindPopup(
        `<b>${l.name || 'Lead'}</b>${interest}<br>${loc}<br><a href="lead-details.html?id=${l.id}">Ver detalhes</a>`
      );
    });
}

export function plotClients(clients) {
  if (!map || typeof L === 'undefined' || !clientsLayer) return;
  clientsLayer.clearLayers();
  clientMarkers = {};
  clients
    .filter((c) => c.lat && c.lng)
    .forEach((c) => {
      const marker = L.marker([c.lat, c.lng], {
        title: c.name || 'Cliente',
        icon: clientIcon || undefined,
      }).addTo(clientsLayer);
      const loc = c.farmName || `(${c.lat.toFixed(4)}, ${c.lng.toFixed(4)})`;
      marker.bindPopup(
        `<b>${c.name || 'Cliente'}</b><br>${loc}<br><a href="client-details.html?clientId=${c.id}&from=agronomo">Ver detalhes</a>`
      );
      clientMarkers[c.id] = marker;
    });
}

export function focusClient(id) {
  const m = clientMarkers[id];
  if (m) {
    const pos = m.getLatLng();
    setMapCenter(pos.lat, pos.lng);
    m.openPopup();
  }
}

export function setVisibleLayers({ showLeads, showClients }) {
  if (!map) return;
  if (leadsLayer) {
    if (showLeads) map.addLayer(leadsLayer);
    else map.removeLayer(leadsLayer);
  }
  if (clientsLayer) {
    if (showClients) map.addLayer(clientsLayer);
    else map.removeLayer(clientsLayer);
  }
}

// Fit map view to an array of [lat, lng] points.
export function fitMapToPoints(points) {
  if (!map || typeof L === 'undefined' || !points.length) return;
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds, { padding: [20, 20] });
}

export function invalidateMapSize() {
  if (map) map.invalidateSize();
}
