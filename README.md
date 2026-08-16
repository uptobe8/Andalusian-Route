# Andalusian Roude

Web app/PWA para planificar y usar rutas camper desde móvil y escritorio.

## Funcionamiento

La aplicación se sirve de forma estática desde GitHub Pages. No necesita `server.mjs`, Convex ni MCP en el navegador.

Fuentes activas:
- OpenStreetMap / Nominatim: búsqueda y geocodificación.
- Overpass: lugares de interés y descubrimiento de destinos.
- OSRM: rutas reales por carretera.
- Open-Meteo: meteorología.
- Park4Night: única fuente externa de pernocta camper; `data/park4night-live.json` se actualiza mediante GitHub Actions.

## Funciones

- Crear una ruta manual o generar 3 propuestas deterministas según días, kilómetros y preferencias.
- Mapa de ruta con capa Park4Night.
- Itinerario día a día, visitados y notas.
- Explorar playas, monumentos, miradores, surf, naturaleza, gastronomía, pueblos y actividades.
- Fichas POI basadas en datos OSM, sin Wikipedia/Wikimedia.
- Park4Night con filtros, mapa, favoritos y check-ins/notas personales.
- Mis rutas, favoritos y spots propios guardados localmente.
- Exportación de spots en GeoJSON.
- PWA con caché del shell y datos Park4Night para uso básico sin cobertura.

## Validación

```bash
npm run check
```

El validador comprueba la estructura activa, las fuentes permitidas, Park4Night y que el planificador no utilice selección aleatoria.
