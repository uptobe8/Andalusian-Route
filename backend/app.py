from pathlib import Path
import json
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .mcp_client import call_tool, list_tools
ROOT=Path(__file__).resolve().parents[1]
FRONT=ROOT/'frontend'
VERIFIED=json.loads((ROOT/'data'/'verified_park4night.json').read_text(encoding='utf-8'))
app=FastAPI(title='Cádiz Camper · Park4Night MCP',version='1.0.0')
app.mount('/css',StaticFiles(directory=FRONT/'css'),name='css')
app.mount('/js',StaticFiles(directory=FRONT/'js'),name='js')

@app.get('/api/health')
async def health():
    try:return {'ok':True,'mcp_tools':await list_tools(),'registry':'com.pulsemcp.mirror/beba-ai-ml-park4night'}
    except Exception as e:return {'ok':False,'error':str(e),'registry':'com.pulsemcp.mirror/beba-ai-ml-park4night'}
@app.get('/api/park4night/verified')
async def verified():return VERIFIED
@app.get('/api/park4night/search')
async def search(lat:float=Query(...),lng:float=Query(...),radius_km:float=Query(15,ge=1,le=100)):
    try:return await call_tool('search_places',{'latitude':lat,'longitude':lng,'radius_km':radius_km})
    except Exception as e:raise HTTPException(status_code=502,detail=f'MCP Park4Night error: {e}')
@app.get('/api/park4night/route')
async def along(start_lat:float,start_lon:float,end_lat:float,end_lon:float,step_km:float=50,corridor_km:float=20):
    try:return await call_tool('search_along_route',{'start_lat':start_lat,'start_lon':start_lon,'end_lat':end_lat,'end_lon':end_lon,'step_km':step_km,'corridor_km':corridor_km})
    except Exception as e:raise HTTPException(status_code=502,detail=f'MCP Park4Night error: {e}')
@app.get('/api/park4night/reviews/{place_id}')
async def reviews(place_id:int):
    try:return await call_tool('get_reviews',{'place_id':place_id})
    except Exception as e:raise HTTPException(status_code=502,detail=f'MCP Park4Night error: {e}')
@app.get('/')
async def index():return FileResponse(FRONT/'index.html')
@app.get('/{path:path}')
async def spa(path:str):return FileResponse(FRONT/'index.html')
