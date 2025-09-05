export async function renderWeather() {
  const container = document.getElementById('homeWeather');
  if (!container) return;
  container.innerHTML = '<span class="text-xs text-gray-500">Carregando clima...</span>';
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
    const iconMap = {
      0: { icon: 'fa-sun', type: 'sun' },
      1: { icon: 'fa-cloud-sun', type: 'cloud' },
      2: { icon: 'fa-cloud-sun', type: 'cloud' },
      3: { icon: 'fa-cloud', type: 'cloud' },
      45: { icon: 'fa-smog', type: 'fog' },
      48: { icon: 'fa-smog', type: 'fog' },
      51: { icon: 'fa-cloud-rain', type: 'rain' },
      53: { icon: 'fa-cloud-rain', type: 'rain' },
      55: { icon: 'fa-cloud-rain', type: 'rain' },
      56: { icon: 'fa-cloud-rain', type: 'rain' },
      57: { icon: 'fa-cloud-rain', type: 'rain' },
      61: { icon: 'fa-cloud-rain', type: 'rain' },
      63: { icon: 'fa-cloud-rain', type: 'rain' },
      65: { icon: 'fa-cloud-showers-heavy', type: 'rain' },
      66: { icon: 'fa-cloud-showers-heavy', type: 'rain' },
      67: { icon: 'fa-cloud-showers-heavy', type: 'rain' },
      71: { icon: 'fa-snowflake', type: 'snow' },
      73: { icon: 'fa-snowflake', type: 'snow' },
      75: { icon: 'fa-snowflake', type: 'snow' },
      77: { icon: 'fa-snowflake', type: 'snow' },
      80: { icon: 'fa-cloud-showers-heavy', type: 'rain' },
      81: { icon: 'fa-cloud-showers-heavy', type: 'rain' },
      82: { icon: 'fa-cloud-showers-heavy', type: 'rain' },
      85: { icon: 'fa-snowflake', type: 'snow' },
      86: { icon: 'fa-snowflake', type: 'snow' },
      95: { icon: 'fa-bolt', type: 'storm' },
      96: { icon: 'fa-bolt', type: 'storm' },
      99: { icon: 'fa-bolt', type: 'storm' }
    };
    const iconData = iconMap[w.weathercode] || { icon: 'fa-question', type: 'unknown' };
    container.innerHTML = `
      <div class="text-center">
        <i class="fas ${iconData.icon} weather-icon ${iconData.type}"></i>
        <div class="text-lg font-semibold">${Math.round(w.temperature)}°C</div>
        <div class="text-xs text-gray-600">Vento ${Math.round(w.windspeed)} km/h</div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<span class="text-xs text-gray-500">Não foi possível carregar o clima.</span>';
  }
}
