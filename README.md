# Tu Ruta Cádiz en Camper — Fresh Convex Build

Versión reconstruida desde un directorio vacío. No reutiliza archivos de versiones anteriores.

## Abrir la app

### Rápido
- Windows: `START_WINDOWS.bat`
- macOS/Linux: `sh START_MAC_LINUX.sh`
- Abre `la URL que imprime `serve.py` (normalmente `http://localhost:8765`)`

También puedes abrir `index.html` directamente en un navegador, aunque servir por HTTP es más fiable para mapas y APIs.

## Funciones
- Home responsive específica para móvil y escritorio.
- Crear ruta con destinos, filtros y preferencias.
- Cálculo real por carretera mediante OSRM con respaldo geográfico si el servicio no responde.
- Mapa Leaflet/OpenStreetMap con ruta y marcadores; SVG local de respaldo.
- Ruta día a día: añadir, eliminar y reordenar paradas.
- Destino, lugares de interés y Google Maps.
- Dónde dormir + enlaces externos Park4Night.
- Explorar, favoritos y perfil.
- Persistencia local inmediata.
- Backend Convex incluido para rutas, favoritos y preferencias.

## Activar Convex
1. `npm install`
2. `CONVEX_AGENT_MODE=anonymous npx convex dev` (o tu despliegue Convex habitual).
3. Copia la URL HTTP del deployment/Convex site en `assets/js/config.js` como `convexSiteUrl`.

Si `convexSiteUrl` está vacío o Convex no está disponible, la app usa `localStorage` automáticamente y sigue funcionando.

## Fotos
La versión usa fotografías remotas distintas de las capturas del diseño. Consulta `docs/PHOTO_SOURCES.txt`.
