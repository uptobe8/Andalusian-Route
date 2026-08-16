# MCP seleccionados para Andalusian Roude

## 1. Park4Night — obligatorio
Fuente solicitada: https://www.pulsemcp.com/servers/beba-ai-ml-park4night
server.json: https://www.pulsemcp.com/servers/beba-ai-ml-park4night/serverjson
Uso en la app: search_places, search_along_route, get_reviews.
La aplicación NO inventa resultados si este MCP falla.

## 2. OpenStreetMap MCP
PulseMCP: https://www.pulsemcp.com/servers/open-street-map
Repositorio: https://github.com/jagan-shanmugam/open-streetmap-mcp
Instalación verificada en su README: `uvx osm-mcp-server`.
Valor: geocodificación, POI, rutas, categorías, exploración de áreas y parking.

## 3. Weather MCP
PulseMCP: https://www.pulsemcp.com/servers/weather-mcp
Repositorio: https://github.com/weather-mcp/weather-mcp
Instalación verificada en su README: `npx -y @dangahagan/weather-mcp@latest`.
Valor para camper: previsión, viento, lluvia, temperatura, UV, calidad del aire y condiciones marinas globales sin API key.

## 4. Google Maps MCP — opcional
PulseMCP: https://www.pulsemcp.com/servers/google-maps
Aporta places, routing, elevación y weather, pero exige API key. No es dependencia obligatoria porque OpenStreetMap + OSRM + Weather MCP ya cubren el flujo principal.

## Datos reales
- Rutas: OSRM live.
- Geocodificación: OpenStreetMap MCP; fallback real a Nominatim.
- POI: OpenStreetMap MCP.
- Weather: Weather MCP.
- Pernocta: Park4Night MCP.
- Convex: persistencia de rutas, favoritos y preferencias cuando se configure una deployment.
