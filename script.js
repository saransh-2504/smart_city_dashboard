const cities = {
      mumbai: {name:'Mumbai', lat:19.0760, lon:72.8777},
      delhi: {name:'Delhi', lat:28.7041, lon:77.1025},
      newyork: {name:'New York', lat:40.7128, lon:-74.0060},
      london: {name:'London', lat:51.5072, lon:-0.1276}
    };
    let selectedCity = 'mumbai';
    const orb = document.getElementById('orb');
    const orbWrap = document.getElementById('orbWrap');
    const cityNameEl = document.getElementById('city-name');
    const tempEl = document.getElementById('temp');
    const descEl = document.getElementById('desc');
    const lastUpdatedEl = document.getElementById('last-updated');
    const windEl = document.getElementById('wind');
    const humEl = document.getElementById('hum');
    const orbState = document.getElementById('orb-state');
    const forecastSummary = document.getElementById('forecast-summary');
    const healthScoreEl = document.getElementById('health-score');
    const citySelect = document.getElementById('citySelect');
    const refreshBtn = document.getElementById('refreshBtn');
    const ctx = document.getElementById('tempChart').getContext('2d');
    let tempChart = new Chart(ctx, {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Temperature (°C)', data: [], tension:0.28, fill:true, pointRadius:2 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{display:false}}, y:{beginAtZero:false}} }
    });
    async function fetchWeather(cityKey){
      const {lat,lon,name} = cities[cityKey];
      cityNameEl.textContent = name;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relativehumidity_2m,windspeed_10m&current_weather=true&timezone=auto`;

      try{
        const res = await fetch(url);
        if(!res.ok) throw new Error('Network response not ok');
        const data = await res.json();

        const cw = data.current_weather || {};
        const temp = cw.temperature ?? data.hourly.temperature_2m[0];
        const wind = cw.windspeed ?? data.hourly.windspeed_10m[0];
        const timeNow = cw.time ?? new Date().toISOString();

        const humidityArr = data.hourly.relativehumidity_2m;
        const tempArr = data.hourly.temperature_2m;
        const windArr = data.hourly.windspeed_10m;
        const timeArr = data.hourly.time;

        const nowIndex = 0; 
        const sliceLen = 24;
        const labels = timeArr.slice(nowIndex, nowIndex + sliceLen).map(t=>t.replace('T',' '));
        const temps = tempArr.slice(nowIndex, nowIndex + sliceLen);

        tempChart.data.labels = labels;
        tempChart.data.datasets[0].data = temps;
        tempChart.update();

        tempEl.textContent = Math.round(temp) + '°C';
        windEl.textContent = (Math.round(wind*10)/10) + ' m/s';
        humEl.textContent = (humidityArr[nowIndex]??'--') + '%';
        lastUpdatedEl.textContent = 'Last updated: ' + new Date().toLocaleString();

        forecastSummary.innerHTML = '';
        for(let i=0;i<4;i++){
          const t = labels[i]; const v = Math.round(temps[i]);
          const node = document.createElement('div');
          node.className = 'muted';
          node.textContent = `${t} — ${v}°C`;
          forecastSummary.appendChild(node);
        }

        const avgTemp = temps.reduce((a,b)=>a+b,0)/temps.length;
        const avgHum = (humidityArr.slice(0,sliceLen).reduce((a,b)=>a+b,0)/sliceLen)||50;
        let score = 100 - Math.abs(25 - avgTemp)*2 - Math.abs(50 - avgHum)*0.4;
        score = Math.max(0, Math.min(100, Math.round(score)));
        healthScoreEl.textContent = `City Health Score: ${score}`;

        updateOrbAppearance(temp, humidityArr[nowIndex]);

      }catch(err){
        console.error(err);
        tempEl.textContent = '--°C';
        descEl.textContent = 'Failed to fetch';
        lastUpdatedEl.textContent = 'Last updated: --';
      }
    }

    function updateOrbAppearance(temp, hum){
      const orbEl = document.getElementById('orb');
      const label = orbState;
      const core = orbEl.querySelector('.core');

      let c1 = '#6df0ff'; 
      if(temp>=30) c1 = '#ff7b5c';
      else if(temp>=20) c1 = '#7b5cff';

      orbEl.style.boxShadow = `0 12px 40px ${c1}40, 0 0 120px ${c1}22`;
      orbEl.style.background = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.06), transparent 8%, ${c1}22 40%, rgba(255,255,255,0.02))`;

      if(temp>=35) label.textContent = 'Hot — Stay Cool';
      else if(temp<=5) label.textContent = 'Cold — Stay Warm';
      else if((hum||0) > 80) label.textContent = 'Humid';
      else label.textContent = 'Orb Healthy';
    }

    const robot = document.getElementById('robot');
    const face = document.getElementById('faceOverlay');
    const leftEye = document.querySelector('.left-eye');
    const rightEye = document.querySelector('.right-eye');
    const mouth = document.getElementById('mouth');

    const mapRange = (v, a, b, c, d) => c + (d - c) * ((v - a) / (b - a));

    document.addEventListener('mousemove', (e)=>{
      const rect = robot.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      const rx = Math.max(-12, Math.min(12, -dy / 20));
      const ry = Math.max(-18, Math.min(18, dx / 20));
      robot.style.transform = `translateZ(0px) translate(${dx/40}px, ${dy/40}px) rotateX(${rx}deg) rotateY(${ry}deg)`;

      const eyeRangeX = 8; const eyeRangeY = 6;
      const ex = Math.max(-eyeRangeX, Math.min(eyeRangeX, dx / 30));
      const ey = Math.max(-eyeRangeY, Math.min(eyeRangeY, dy / 40));
      leftEye.style.transform = `translate(${ex}px, ${ey}px)`;
      rightEye.style.transform = `translate(${ex}px, ${ey}px)`;

      const mouthScale = mapRange(Math.abs(dx), 0, window.innerWidth/2, 0.9, 1.25);
      mouth.style.transform = `scaleX(${mouthScale})`;
    });

    setInterval(()=>{
      robot.classList.add('breath');
      setTimeout(()=> robot.classList.remove('breath'), 650);
    }, 3000);

    function updateOrbAppearance(temp, hum){
      const label = orbState;

      let expr = 'neutral';
      if(temp>=35) expr = 'hot';
      else if(temp<=5) expr = 'cold';
      else if((hum||0) > 80) expr = 'humid';
      else expr = 'happy';

      face.dataset.expr = expr;

      if(expr==='hot') label.textContent = 'Hot — Stay Cool';
      else if(expr==='cold') label.textContent = 'Cold — Stay Warm';
      else if(expr==='humid') label.textContent = 'Humid';
      else label.textContent = 'Orb Healthy';

      let glow = 'rgba(109,240,255,0.18)';
      if(expr==='hot') glow = 'rgba(255,123,92,0.2)';
      else if(expr==='cold') glow = 'rgba(150,200,255,0.22)';
      else if(expr==='humid') glow = 'rgba(120,255,180,0.16)';
      robot.style.boxShadow = `0 20px 80px ${glow}`;

      if(expr==='happy'){
        mouth.style.height = '10px'; mouth.style.borderRadius = '20px'; mouth.style.background = 'linear-gradient(90deg,#7b5cff,#6df0ff)';
      } else if(expr==='hot'){
        mouth.style.height = '6px'; mouth.style.borderRadius = '6px'; mouth.style.background = 'linear-gradient(90deg,#ff7b5c,#ffb7a8)';
      } else if(expr==='cold'){
        mouth.style.height = '6px'; mouth.style.borderRadius = '6px'; mouth.style.background = 'linear-gradient(90deg,#bfe0ff,#7b9cff)';
      } else if(expr==='humid'){
        mouth.style.height = '8px'; mouth.style.borderRadius = '10px'; mouth.style.background = 'linear-gradient(90deg,#7fffd4,#6df0ff)';
      }
    } (scale)
    setInterval(()=>{
      orb.style.transform += ' scale(1.015)';
      setTimeout(()=>{ orb.style.transform = orb.style.transform.replace(' scale(1.015)',''); }, 350);
    }, 3000);

    refreshBtn.addEventListener('click', ()=>{ fetchWeather(selectedCity); });
    citySelect.addEventListener('change', (e)=>{ selectedCity = e.target.value; fetchWeather(selectedCity); });

    fetchWeather(selectedCity);
    setInterval(()=> fetchWeather(selectedCity), 60_000);