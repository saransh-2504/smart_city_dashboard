const API_KEY_OPENWEATHER = "80a25ee136b42335beffca3c666cf528"; 

const AUTO_REFRESH_MS = 30000;

//(New Delhi)
let currentCoords = { lat: 28.6139, lon: 77.2090 };
let autoRefreshTimer = null;

// Chart instances
let tempChart, aqiChart, humChart, temp24Chart, pm24Chart;
let map, marker;

//fetch JSON 
async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
  return res.json();
}

function openWeatherWeatherUrl(lat, lon){
  return `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY_OPENWEATHER}`;
}

function openWeatherGeocodeUrl(q){
  return `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${API_KEY_OPENWEATHER}`;
}

//Meteo Air Quality API
function openMeteoAQUrl(lat, lon){
  // includes hourly PM2.5 and other components for last 48 hours
  return `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide&utc=true`;
}

// Open-Meteo Weather Forecast for hourly temperature (past 48h) - no key
function openMeteoWeatherHistoryUrl(lat, lon){
  // Request hourly temperature past 48 hours by using timezone=UTC and hourly=temperature_2m
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relativehumidity_2m,windspeed_10m&timezone=UTC`;
}

// UI elements
const cityNameEl = () => document.getElementById('cityName');
const lastUpdatedEl = () => document.getElementById('lastUpdated');
const tempValueEl = () => document.getElementById('tempValue');
const aqiValueEl = () => document.getElementById('aqiValue');
const humidityEl = () => document.getElementById('humidity');
const windEl = () => document.getElementById('wind');

// Initialize map
function initMap(){
  map = L.map('map', { zoomControl: true, attributionControl: false }).setView([currentCoords.lat, currentCoords.lon], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(map);
  marker = L.marker([currentCoords.lat, currentCoords.lon]).addTo(map);
}

// Update marker position
function updateMarker(lat, lon){
  marker.setLatLng([lat, lon]);
  map.setView([lat, lon], 11);
}

// Initialize charts with empty data
function initCharts(){
  const ctxTemp = document.getElementById('tempChart').getContext('2d');
  tempChart = new Chart(ctxTemp, { type:'doughnut', data:{labels:['Temp',''], datasets:[{data:[0,100],backgroundColor:['#f97316','#0b1220'],hoverOffset:4}] }, options:{plugins:{legend:{display:false}}}});

  const ctxAqi = document.getElementById('aqiChart').getContext('2d');
  aqiChart = new Chart(ctxAqi, { type:'doughnut', data:{labels:['PM2.5',''], datasets:[{data:[0,100],backgroundColor:['#ef4444','#0b1220'],hoverOffset:4}] }, options:{plugins:{legend:{display:false}}}});

  const ctxHum = document.getElementById('humChart').getContext('2d');
  humChart = new Chart(ctxHum, { type:'bar', data:{labels:['Humidity'], datasets:[{label:'%',data:[0],backgroundColor:['#3b82f6']}] }, options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}});

  const ctxTemp24 = document.getElementById('temp24Chart').getContext('2d');
  temp24Chart = new Chart(ctxTemp24, { type:'line', data:{labels:[], datasets:[{label:'Temp (°C)',data:[],borderWidth:2,pointRadius:2,fill:true}] }, options:{scales:{x:{display:true},y:{beginAtZero:false}}}});

  const ctxPm24 = document.getElementById('pm24Chart').getContext('2d');
  pm24Chart = new Chart(ctxPm24, { type:'line', data:{labels:[], datasets:[{label:'PM2.5 (µg/m³)',data:[],borderWidth:2,pointRadius:2,fill:true}] }, options:{scales:{x:{display:true},y:{beginAtZero:true}}}});
}

// Main refresh function: fetch weather + AQ data and update UI
async function refreshAll(lat, lon, cityLabel){
  try{
    document.getElementById('refreshBtn').disabled = true;
    // Fetch OpenWeatherMap current weather (if API key available)
    let weatherData = null;
    if(API_KEY_OPENWEATHER){
      try{ weatherData = await fetchJSON(openWeatherWeatherUrl(lat,lon)); } catch(e){ console.warn('OpenWeather failed', e); }
    }

    // Fetch Open-Meteo hourly air quality and weather
    const aqData = await fetchJSON(openMeteoAQUrl(lat,lon));
    const meteoData = await fetchJSON(openMeteoWeatherHistoryUrl(lat,lon));

    // Update top-level cards
    const now = new Date();
    cityNameEl().innerText = cityLabel || (weatherData ? (`${weatherData.name}, ${weatherData.sys.country}`) : `${lat.toFixed(3)}, ${lon.toFixed(3)}`);
    lastUpdatedEl().innerText = `Last updated: ${now.toLocaleString()}`;

    // Current values: prefer OpenWeather current (more immediate) else estimate from hourly
    let currentTemp = null, currentHum=null, currentWind=null;
    if(weatherData){
      currentTemp = weatherData.main.temp;
      currentHum = weatherData.main.humidity;
      currentWind = weatherData.wind.speed;
    } else {
      // fallback: take latest hourly from meteoData
      const hr = meteoData.hourly;
      const lastIdx = hr.time.length - 1;
      currentTemp = hr.temperature_2m[lastIdx];
      currentHum = hr.relativehumidity_2m[lastIdx];
      currentWind = hr.windspeed_10m[lastIdx];
    }

   tempValueEl().innerText = `${Math.round(currentTemp)} °C`;
    humidityEl().innerText = `${Math.round(currentHum)} %`;
    windEl().innerText = `${currentWind} m/s`;

    // Update small charts
    tempChart.data.datasets[0].data = [Math.max(0,currentTemp+20), 100]; // visual doughnut trick
    tempChart.update();

    // Process AQ safely with fallback to latest non-null value
    let pmArr = null;
    let pmNow = null;

    if (aqData && aqData.hourly && Array.isArray(aqData.hourly.pm2_5)) {
      pmArr = aqData.hourly.pm2_5;

      // Find latest non-null PM2.5 value
      for (let i = pmArr.length - 1; i >= 0; i--) {
        if (pmArr[i] !== null && pmArr[i] !== undefined) {
          pmNow = pmArr[i];
          break;
        }
      }
    } else {
      console.warn("PM2.5 data missing in AQ response:", aqData);
    }

    aqiValueEl().innerText = pmNow !== null ? `${pmNow.toFixed(1)} µg/m³` : '--';

    // avoid NaN in chart
    const safePm = pmNow !== null ? pmNow : 0;

    aqiChart.data.datasets[0].data = [Math.max(0, safePm), 200];
    aqiChart.update();

    // Humidity bar
    humChart.data.datasets[0].data = [Math.round(currentHum)];
    humChart.update();

    // 24h charts: use meteoData.hourly times (UTC)
    const times = meteoData.hourly.time; // array of ISO strings UTC
    const temps = meteoData.hourly.temperature_2m;
    const humid = meteoData.hourly.relativehumidity_2m;

    // Build last 24 values (if available)
    const labels24 = []; const t24 = []; const pm24 = [];
    const total = Math.min(times.length, 48); // open-meteo may give 48 values
    for(let i = total-24; i < total; i++){
      if(i<0) continue;
      labels24.push(new Date(times[i]).toLocaleString());
      t24.push(temps[i]);
      // find corresponding pm value: open-meteo aq hourly aligns to indexes - use same index
      pm24.push((aqData.hourly.pm2_5 && aqData.hourly.pm2_5[i]) ? aqData.hourly.pm2_5[i] : null);
    }

    // Update charts
    temp24Chart.data.labels = labels24;
    temp24Chart.data.datasets[0].data = t24;
    temp24Chart.update();

    pm24Chart.data.labels = labels24;
    pm24Chart.data.datasets[0].data = pm24;
    pm24Chart.update();

    // Map marker update
    updateMarker(lat, lon);

    // Re-enable refresh
    document.getElementById('refreshBtn').disabled = false;

  } catch(err){
    console.error('refreshAll error', err);
    alert('Error fetching data: '+err.message);
    document.getElementById('refreshBtn').disabled = false;
  }
}

// City search using OpenWeather geocoding (if key provided)
async function searchCity(q){
  if(!API_KEY_OPENWEATHER) throw new Error('OpenWeather API key not set. Use preset cities or add API key in script.js');
  const data = await fetchJSON(openWeatherGeocodeUrl(q));
  if(!data || data.length===0) throw new Error('City not found');
  const item = data[0];
  return { lat: item.lat, lon: item.lon, label: `${item.name}, ${item.country}` };
}

// Attach UI events
function attachEvents(){
  document.getElementById('presetCities').addEventListener('change', async (e)=>{
    const [lat,lon] = e.target.value.split(',').map(Number);
    currentCoords = { lat, lon };
    await refreshAll(lat,lon);
  });

  document.getElementById('searchBtn').addEventListener('click', async ()=>{
    const q = document.getElementById('cityInput').value.trim();
    if(!q) return alert('Type a city name first');
    try{
      const res = await searchCity(q);
      currentCoords = { lat: res.lat, lon: res.lon };
      await refreshAll(res.lat, res.lon, res.label);
    } catch(e){ alert('Search failed: '+e.message); }
  });

  document.getElementById('refreshBtn').addEventListener('click', ()=>{
    refreshAll(currentCoords.lat, currentCoords.lon);
  });
}

// Auto-refresh
function startAutoRefresh(){
  if(autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(()=>{
    refreshAll(currentCoords.lat, currentCoords.lon);
  }, AUTO_REFRESH_MS);
  document.getElementById('autoRefreshStatus').innerText = `ON (${AUTO_REFRESH_MS/1000}s)`;
}

// Initialize everything
async function init(){
  initMap();
  initCharts();
  attachEvents();
  // initial fetch
  await refreshAll(currentCoords.lat, currentCoords.lon, 'New Delhi, IN');
  startAutoRefresh();
}

// Kickoff
window.addEventListener('DOMContentLoaded', ()=>{
  init().catch(err=>console.error(err));
} );
/* ------------------------------------------
   ROBOT MOVEMENT INSIDE CITY CARD
------------------------------------------ */

const robotEl = document.getElementById("robotAssistant");
const faceEl = robotEl.querySelector(".face");
const leftEyeEl = robotEl.querySelector(".left-eye");
const rightEyeEl = robotEl.querySelector(".right-eye");
const mouthEl = robotEl.querySelector(".mouth");

document.addEventListener("mousemove", (e) => {
  const rect = robotEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;

  // subtle head tilt
  const rx = Math.max(-10, Math.min(10, -dy / 30));
  const ry = Math.max(-14, Math.min(14, dx / 30));
  robotEl.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;

  // eyes
  const ex = Math.max(-6, Math.min(6, dx / 35));
  const ey = Math.max(-4, Math.min(4, dy / 45));
  leftEyeEl.style.transform = `translate(${ex}px,${ey}px)`;
  rightEyeEl.style.transform = `translate(${ex}px,${ey}px)`;

  // mouth reaction
  const scale = 1 + Math.min(0.35, Math.abs(dx) / 500);
  mouthEl.style.transform = `scaleX(${scale})`;
});

// breathing
setInterval(() => {
  robotEl.classList.add("breathe");
  setTimeout(() => robotEl.classList.remove("breathe"), 500);
}, 2800);
