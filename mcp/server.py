#!/usr/bin/env python3
"""Park4Night MCP server integration.
Source architecture: https://github.com/Beba-ai-ml/park4night-mcp (MIT).
Registry reference: com.pulsemcp.mirror/beba-ai-ml-park4night.
This local copy keeps the same public endpoints and MCP tool contract.
"""
import asyncio, base64, json, math, re, sys
from mcp.server.fastmcp import FastMCP
import httpx

mcp = FastMCP("park4night", instructions=(
    "Search campervan/motorhome spots on Park4Night. Prefer free/non-camping places unless explicitly requested otherwise."
))
API_AROUND='https://park4night.com/api/places/around'
API_REVIEWS='https://guest.park4night.com/services/V4.1/commGet.php'
TIMEOUT=15.0
TYPE_CODES={
 'P':'Parking lot day/night','CP':'Parking lot day/night','ACS':'Motorhome area','ACC_P':'Motorhome area',
 'ACC_PR':'Motorhome area (private)','C':'Camping','CC':'Camping','CPCC':'Private car park for campers',
 'AR':'Rest area','PN':'Surrounded by nature','BP':'Off the beaten track','AP':'Picnic area','APN':'Picnic area',
 'PI':'Point of interest','DS':'Service area (water/dump)','PSS':'Service area (water/dump)','ASS':'Service area (water/dump)',
 'EH':'Extra - homestays','EF':'Extra - farm','F':'On the farm','FE':'On the farm','CPJ':'Parking lot day only',
 'PJ':'Parking lot day only','OR':'Overnight rest area'
}

def strip_html(t): return re.sub(r'<[^>]+>','',t or '').strip()
def hav(lat1,lon1,lat2,lon2):
    dlat=math.radians(lat2-lat1); dlon=math.radians(lon2-lon1)
    a=math.sin(dlat/2)**2+math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return 2*6371.0*math.asin(math.sqrt(a))
def grid(lat,lon,r):
    pts=[(lat,lon)]
    if r<15:return pts
    kmlat=111.0; kmlon=111.0*math.cos(math.radians(lat)); rings=[.6] if r<35 else ([.4,.75] if r<60 else [.33,.6,.85])
    for pct in rings:
        off=r*pct; dlat=off/kmlat; dlon=off/kmlon
        pts += [(lat+dlat,lon),(lat-dlat,lon),(lat,lon+dlon),(lat,lon-dlon)]
    return [(round(a,5),round(b,5)) for a,b in pts]
def interp(lat1,lon1,lat2,lon2,step):
    step=max(step,5.0); dist=hav(lat1,lon1,lat2,lon2); n=min(200,max(2,int(dist/step)+1))
    return [(round(lat1+i/(n-1)*(lat2-lat1),5),round(lon1+i/(n-1)*(lon2-lon1),5)) for i in range(n)]
def fmt(p):
    ptype=p.get('type',{}) if isinstance(p.get('type',{}),dict) else {}
    code=ptype.get('code','?'); services=p.get('services',[]); amenities=[]
    if isinstance(services,list):
        for s in services:
            if isinstance(s,dict):
                if s.get('label'): amenities.append(s['label'])
            elif s: amenities.append(str(s))
    addr=p.get('address',{}) if isinstance(p.get('address',{}),dict) else {}
    pid=p.get('id'); title=strip_html(p.get('title_short') or p.get('title') or '')
    return {'id':pid,'name':title or strip_html(p.get('description',''))[:80],'category':TYPE_CODES.get(code,ptype.get('label',code)),
      'latitude':p.get('lat'),'longitude':p.get('lng'),'rating':p.get('rating') or None,'num_reviews':p.get('review') or None,
      'description':strip_html(p.get('description',''))[:300],'country':addr.get('country',''),'city':addr.get('city',''),
      'amenities':', '.join(amenities) if amenities else None,'is_pro':p.get('isPro',False),
      'url':f'https://park4night.com/en/place/{pid}' if pid else None}
async def fetch_around(client,lat,lon,r):
    resp=await client.get(API_AROUND,params={'lat':lat,'lng':lon,'radius':r});resp.raise_for_status()
    return json.loads(base64.b64decode(resp.text))

@mcp.tool()
async def search_places(latitude:float, longitude:float, radius_km:float=30.0)->str:
    seen=set(); places=[]; pts=grid(latitude,longitude,radius_km)
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        results=await asyncio.gather(*[fetch_around(client,a,b,radius_km) for a,b in pts],return_exceptions=True)
    for rows in results:
        if isinstance(rows,Exception): continue
        for p in rows:
            pid=p.get('id')
            if pid in seen: continue
            try:
                d=hav(latitude,longitude,float(p.get('lat',0)),float(p.get('lng',0)))
                if d<=radius_km:
                    seen.add(pid); x=fmt(p); x['distance_km']=round(d,1); places.append(x)
            except (ValueError,TypeError): pass
    places.sort(key=lambda x:-(float(x.get('rating') or 0)))
    return json.dumps({'source':'park4night_mcp','query':{'lat':latitude,'lng':longitude,'radius_km':radius_km},'count':len(places),'places':places[:50]},ensure_ascii=False)

@mcp.tool()
async def search_along_route(start_lat:float,start_lon:float,end_lat:float,end_lon:float,step_km:float=50.0,corridor_km:float=20.0)->str:
    pts=interp(start_lat,start_lon,end_lat,end_lon,step_km);seen=set();out=[]
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for idx,(lat,lon) in enumerate(pts):
            try: rows=await fetch_around(client,lat,lon,corridor_km)
            except Exception: continue
            for p in rows:
                if p.get('id') in seen: continue
                try:
                    d=hav(lat,lon,float(p.get('lat',0)),float(p.get('lng',0)))
                    if d<=corridor_km:
                        seen.add(p.get('id'));x=fmt(p);x['route_segment']=idx;x['distance_from_route_km']=round(d,1);out.append(x)
                except (ValueError,TypeError):pass
    out.sort(key=lambda x:(x['route_segment'],-float(x.get('rating') or 0)))
    return json.dumps({'source':'park4night_mcp','count':len(out),'places':out[:50]},ensure_ascii=False)

@mcp.tool()
async def get_reviews(place_id:int)->str:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r=await client.get(API_REVIEWS,params={'lieu_id':place_id});r.raise_for_status();raw=r.json()
    rows=raw.get('commentaires',raw.get('comments',[])) if isinstance(raw,dict) else (raw if isinstance(raw,list) else [])
    reviews=[]
    for x in rows[:20]:
        reviews.append({'rating':x.get('note'),'date':str(x.get('date',''))[:10], 'username':x.get('username') or x.get('utilisateur_creation') or 'anonymous',
          'comment':(x.get('commentaire_en') or x.get('commentaire') or x.get('commentaire_fr') or '')[:500]})
    return json.dumps({'source':'park4night_mcp','place_id':place_id,'count':len(rows),'reviews':reviews},ensure_ascii=False)

if __name__=='__main__': mcp.run(transport='stdio')
