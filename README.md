# Cádiz Camper · Park4Night MCP REAL

Esta entrega no usa ratings, IDs o fichas inventadas.

## Fuente de Park4Night
- PulseMCP: https://www.pulsemcp.com/servers/beba-ai-ml-park4night
- Registry name: `com.pulsemcp.mirror/beba-ai-ml-park4night`
- Implementación: https://github.com/Beba-ai-ml/park4night-mcp
- Herramientas MCP: `search_places`, `search_along_route`, `get_reviews`
- Transporte: stdio.
- Upstream leído por el MCP: `https://park4night.com/api/places/around` y `https://guest.park4night.com/services/V4.1/commGet.php`.

## Cómo funciona la app
1. `backend/mcp_client.py` abre el servidor MCP de `mcp/server.py` por stdio.
2. El navegador NO llama directamente a Park4Night. Llama al backend local.
3. `/api/park4night/search` invoca realmente `search_places`.
4. `/api/park4night/reviews/{id}` invoca realmente `get_reviews`.
5. El botón **ACTUALIZAR MCP** sustituye la caché verificada por resultados LIVE.

## Datos reales incluidos como caché inicial
`data/verified_park4night.json` contiene cuatro fichas verificadas el 16/08/2026 para que la app no muestre datos falsos si se abre sin backend:
- #627117 Parking Bolonia Beach
- #26458 Zahara de los Atunes
- #513997 The Van Spot, El Palmar
- #453068 Los Caños de Meca, Avenida Trafalgar

Son registros reales con enlaces a sus fichas Park4Night. La app los identifica como **verificados**, no como consulta LIVE.

## Ejecutar
### macOS/Linux
`./start.sh`

### Windows
Doble clic en `start.bat`.

El primer arranque instala `mcp`, `httpx`, `fastapi` y `uvicorn`. Después abre `http://127.0.0.1:8080`.

## Requisito para consulta LIVE
La máquina que ejecute la app debe tener Internet. El entorno donde se generó este ZIP no permite conexiones salientes desde el contenedor, por eso la verificación de las fichas reales se realizó contra las páginas públicas accesibles en web y se incluyó la caché verificada. La integración MCP sí queda cableada para ejecutarse en una máquina con acceso a Internet.
