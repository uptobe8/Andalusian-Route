# Andalusian Roude

Nueva app creada desde cero para planificar rutas en camper por toda Andalucía.

## Arranque
Requisitos: Node 20+, `npx` y `uvx` para los MCP locales.

```bash
node server.mjs
```
Abre `http://localhost:8080`.

## MCP
- Park4Night se resuelve dinámicamente desde su `server.json` de PulseMCP. Si PulseMCP publica un paquete npm/pypi instalable, la app lo ejecuta por stdio automáticamente.
- Si Park4Night requiere un comando manual, define:
  - `PARK4NIGHT_MCP_COMMAND`
  - `PARK4NIGHT_MCP_ARGS` como JSON, por ejemplo `["server.py"]`
- OpenStreetMap: `uvx osm-mcp-server`
- Weather: `npx -y @dangahagan/weather-mcp@latest`

No hay fichas Park4Night, reviews, POI ni weather inventados: si un proveedor real falla, la interfaz muestra el error.

## Legibilidad
Base 16px. Menús 12–15px. Timeline: nombres 19px móvil / 22px escritorio, metadatos 14–15px, chips 12px. Botones 15px.
