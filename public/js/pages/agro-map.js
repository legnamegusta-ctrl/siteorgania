let map;
let leadsLayer;

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
  return map;
}

export function setMapCenter(lat, lng, zoom=14) {
  if (map) map.setView([lat,lng], zoom);
}

export function plotLeads(leads) {
  if (!map || typeof L === 'undefined' || !leadsLayer) return;
  leadsLayer.clearLayers();
  leads.filter(l=>l.lat && l.lng).forEach(l=> {
    L.marker([l.lat,l.lng]).addTo(leadsLayer);
  });
}
