let map;
let leadsLayer;
let clientsLayer;

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
      }).addTo(leadsLayer);
      marker.bindPopup(`<b>${l.name || 'Lead'}</b><br>${l.farmName || ''}`);
    });
}

export function plotClients(clients) {
  if (!map || typeof L === 'undefined' || !clientsLayer) return;
  clientsLayer.clearLayers();
  clients
    .filter((c) => c.lat && c.lng)
    .forEach((c) => {
      const marker = L.marker([c.lat, c.lng], {
        title: c.name || 'Cliente',
      }).addTo(clientsLayer);
      marker.bindPopup(
        `<b>${c.name || 'Cliente'}</b><br>${c.farmName || ''}`
      );
    });
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
