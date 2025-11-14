What this project has:
- Clean responsive UI
- Weather (OpenWeatherMap, optional API key) for current weather
- Air quality (Open-Meteo air-quality endpoint, no key required)
- Charts: Chart.js (doughnut, line, bar)
- Interactive map: Leaflet (OpenStreetMap)
- Auto-refresh mechanism (30s)
- City search (requires OpenWeatherMap API key) + preset city dropdown

How to run locally:
1. Save the top sections into three files: index.html, style.css, script.js
2. Edit script.js and set your OpenWeatherMap API key at the top (optional but recommended)
   - Get key at https://home.openweathermap.org/users/sign_up
3. Run a local static server (recommended) because some browsers block fetch from file://
   - Python: `python -m http.server 8000`
   - Node (serve): `npx serve` or `npm i -g serve` then `serve .`
4. Open http://localhost:8000 in your browser.

Notes & improvements you can add (extra credit):
- Add traffic layer via HERE or TomTom APIs (requires extra API keys + paid usage in some cases)
- Add caching/Throttling so API quota limits are respected
- Add backend proxy to hide API keys (for production)
- Add user-selectable refresh interval and pause/resume
- Add alerts for high AQI levels with colors and suggestions
- Add CSV export of last 24h data
- Add unit tests for data parsing functions

Security:
- Do not publish your OpenWeather API key in public GitHub without using a server-side proxy. For this assignment, using the key in client is ok for demo but mention in README.

License: MIT

