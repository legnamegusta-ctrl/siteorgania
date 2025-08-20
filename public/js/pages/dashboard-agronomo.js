import { initBottomNav, bindPlus, toggleModal } from './agro-bottom-nav.js';
import { getCurrentPositionSafe } from '../utils/geo.js';
import { initAgroMap, setMapCenter, plotLeads } from './agro-map.js';
import { getLeads, addLead } from '../stores/leadsStore.js';

export function initAgronomoDashboard() {
  const quickModal = document.getElementById('quickActionsModal');
  const addLeadModal = document.getElementById('addLeadModal');
  const latInput = document.getElementById('leadLat');
  const lngInput = document.getElementById('leadLng');
  const btnUseLocation = document.getElementById('btnUseLocation');

  initBottomNav();
  initAgroMap();
  plotLeads(getLeads());

  bindPlus(() => toggleModal(quickModal, true));
  document.getElementById('btnQuickClose')?.addEventListener('click', () => toggleModal(quickModal, false));
  document.getElementById('btnQuickAddLead')?.addEventListener('click', () => {
    toggleModal(quickModal, false);
    toggleModal(addLeadModal, true);
    ensureLeadMap();
  });
  document.getElementById('btnCancelLead')?.addEventListener('click', () => toggleModal(addLeadModal, false));

  let leadMap;
  let leadMarker;
  function ensureLeadMap() {
    if (typeof L === 'undefined') return;
    if (!leadMap) {
      leadMap = L.map('leadMap').setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(leadMap);
    }
    if (latInput.value && lngInput.value) {
      setLeadMarker(parseFloat(latInput.value), parseFloat(lngInput.value));
    }
  }
  function setLeadMarker(lat, lng) {
    if (!leadMap || typeof L === 'undefined') return;
    if (leadMarker) leadMarker.setLatLng([lat, lng]);
    else leadMarker = L.marker([lat, lng]).addTo(leadMap);
    leadMap.setView([lat, lng], 14);
  }

  btnUseLocation?.addEventListener('click', async () => {
    const pos = await getCurrentPositionSafe();
    if (pos) {
      latInput.value = pos.lat.toFixed(6);
      lngInput.value = pos.lng.toFixed(6);
      ensureLeadMap();
      setLeadMarker(pos.lat, pos.lng);
    }
  });

  document.getElementById('leadForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('leadNome').value.trim();
    const propriedade = document.getElementById('leadPropriedade').value.trim();
    if (!nome || !propriedade) return;
    const notas = document.getElementById('leadNotas').value.trim();
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    const newLead = addLead({ nome, propriedade, notas, lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng });
    console.log('[LEADS] novo', newLead.id);
    plotLeads(getLeads());
    if (newLead.lat && newLead.lng) setMapCenter(newLead.lat, newLead.lng);
    location.hash = '#mapa';
    toggleModal(addLeadModal, false);
  });
}
