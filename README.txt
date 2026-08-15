TU RUTA CÁDIZ EN CAMPER — RECONSTRUCCIÓN COMPLETA DESDE CERO

Estructura:
- index.html
- assets/css/app.css
- assets/js/data.js
- assets/js/app.js
- assets/svg/camper-sketch.svg
- manifest.webmanifest
- server.py
- start-server.command
- start-server.bat

Ejecución recomendada:
1. macOS: doble clic en start-server.command o ejecuta `python3 server.py`.
2. Windows: doble clic en start-server.bat.
3. Abre http://localhost:8080

También puede abrirse index.html directamente, aunque un servidor HTTP es la forma correcta de probar una web app.

Pantallas:
Inicio, Crear ruta, Resultado/Mapa, Ruta día a día, Destino, Park4Night,
Detalle de pernocta, Explorar, POI, Favoritos y Perfil.

Funcionalidad:
- Navegación SPA por hash.
- Calcular ruta.
- Añadir/quitar destinos.
- Activar filtros.
- Reordenar/eliminar paradas.
- Añadir parada.
- Zoom del mapa SVG.
- Favoritos persistentes en localStorage.
- Búsqueda de pernocta.
- Abrir Park4Night y Google Maps.
- Compartir/copiar ruta.
- Responsive móvil/tablet/escritorio.
