export async function renderWeather() {
  const container = document.getElementById('homeWeather');
  if (!container) return;
  container.innerHTML = '<p class="text-sm text-gray-500">Carregando clima...</p>';
  try {
    let lat = -15.78;
    let lon = -47.93;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch {}
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.current_weather) throw new Error('Sem dados');
    const w = data.current_weather;
    container.innerHTML = `
      <h3 class="font-semibold mb-2">Clima atual</h3>
      <div class="weather-temp">${Math.round(w.temperature)}°C</div>
      <div class="text-sm text-gray-600">Vento: ${Math.round(w.windspeed)} km/h</div>
    `;
  } catch (e) {
    container.innerHTML = '<p class="text-sm text-gray-500">Não foi possível carregar o clima.</p>';
  }
}
