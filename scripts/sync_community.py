from __future__ import annotations

import concurrent.futures
import datetime as dt
import hashlib
import importlib.util
import json
import math
import re
import sys
import time
import unicodedata
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
import trafilatura

YEAR = 2026
OUT = Path('data/community-index.json')
STATUS_OUT = Path('data/community-source-status.json')
UA = 'AndalusianRoude/1.0 traveler-community-index (+https://github.com/uptobe8/Andalusian-Route)'
SESSION = requests.Session()
SESSION.headers.update({'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.5'})
TIMEOUT = 15

CITIES = [
    ('Málaga','Andalucía','malaga'),('Granada','Andalucía','granada'),('Sevilla','Andalucía','sevilla'),('Córdoba','Andalucía','cordoba'),
    ('Cádiz','Andalucía','cadiz'),('Tarifa','Andalucía','tarifa'),('Conil de la Frontera','Andalucía','conil_de_la_frontera'),('Nerja','Andalucía','nerja'),
    ('Ronda','Andalucía','ronda'),('Almería','Andalucía','almeria'),('Huelva','Andalucía','huelva'),('Jaén','Andalucía','jaen'),
    ('Jerez de la Frontera','Andalucía','jerez_de_la_frontera'),('Marbella','Andalucía','marbella'),
    ('Cáceres','Extremadura','caceres'),('Mérida','Extremadura','merida'),('Badajoz','Extremadura','badajoz'),('Trujillo','Extremadura','trujillo'),
    ('Barcelona','Cataluña','barcelona'),('Girona','Cataluña','girona'),('Tarragona','Cataluña','tarragona'),('Lleida','Cataluña','lleida'),('Cadaqués','Cataluña','cadaques'),('Sitges','Cataluña','sitges'),
    ('Valencia','Comunitat Valenciana','valencia'),('Alicante','Comunitat Valenciana','alicante'),('Murcia','Región de Murcia','murcia'),('Cartagena','Región de Murcia','cartagena'),
    ('Madrid','Comunidad de Madrid','madrid'),('Toledo','Castilla-La Mancha','toledo'),
]

BLOG_INDEXES = [
    ('Autocamperly','https://autocamperly.com/blog/'),('Alhambra Camper','https://alhambracamper.com/blog/'),('Alas de Ruta','https://alasderuta.com/blog/'),
    ('WalabiCamper','https://walabicamper.com/blog/'),('Áreas Autocaravanas Andalucía','https://areasautocaravanasandalucia.com/diario-de-viaje/'),('Furgocasa','https://www.furgocasa.com/es/blog'),
]
REDDIT_SUBS = ['travel','solotravel','GoingToSpain','Spain','vanlife','campervans','surfing','roadtrip']

CATEGORY_TERMS = {
    'playas':['playa','playas','cala','calas','beach','arena','mar'],
    'monumentos':['monumento','castillo','alcazaba','catedral','iglesia','museo','torre','puente','romano','histórico','historico'],
    'miradores':['mirador','balcón','balcon','panorámica','panoramica','vistas','viewpoint'],
    'surf':['surf','kitesurf','windsurf','olas','spot de surf'],
    'atardecer':['atardecer','puesta de sol','ocaso','sunset','hora dorada'],
    'actividades':['actividad','kayak','barco','senderismo','ruta','buceo','snorkel','bicicleta','aventura','excursión','excursion'],
    'gastro':['chiringuito','restaurante','taberna','bar de tapas','mercado','tapas','tapeo','espetos','gastronomía','gastronomia'],
    'naturaleza':['parque natural','sierra','reserva','cueva','desfiladero','sendero','bosque','duna','acantilado','naturaleza'],
    'pueblos':['pueblo','casco antiguo','villa','aldea','barrio histórico','barrio historico'],
}
STRICT = {'atardecer','surf','gastro'}
MINUBE_HINTS = {
    'playas':['playa'], 'monumentos':['monument','cultura','muse','castill','igles'], 'miradores':['mirador'],
    'gastro':['restaur','gastr','mercado'], 'naturaleza':['aire-libre','natur','parque'], 'actividades':['aventura','actividad'], 'pueblos':['pueblo'],
}


def norm(s: str) -> str:
    s = unicodedata.normalize('NFD', str(s or ''))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+',' ',re.sub(r'[^a-zA-Z0-9ñÑ ]+',' ',s)).strip().lower()


def get(url: str, **kwargs):
    r = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True, **kwargs)
    r.raise_for_status()
    return r


def html_text(html: str) -> str:
    txt = trafilatura.extract(html, include_links=False, include_images=False, include_comments=True, output_format='txt')
    return re.sub(r'\s+',' ',txt or '').strip()


def first(text: str, n=520):
    text = re.sub(r'\s+',' ',text or '').strip()
    return text if len(text)<=n else text[:n].rsplit(' ',1)[0]+'…'


def sentence_with(text: str, terms: list[str]):
    for s in re.split(r'(?<=[.!?])\s+', text or ''):
        ns=norm(s)
        if 30<=len(s)<=700 and any(norm(t) in ns for t in terms):
            return s.strip()
    return ''


def categories_for(title: str, body: str, hints: set[str]):
    n=norm(title+' '+body); out=set(hints)
    for cat,terms in CATEGORY_TERMS.items():
        if any(norm(t) in n for t in terms): out.add(cat)
    for cat in STRICT:
        if cat in out and not any(norm(t) in n for t in CATEGORY_TERMS[cat]): out.discard(cat)
    return sorted(out)


def num(pattern,text,default=0):
    m=re.search(pattern,text,re.I)
    if not m:return default
    try:return float(m.group(1).replace(',','.'))
    except:return default


def parse_minube(url, city, region, hints):
    try:
        r=get(url); s=BeautifulSoup(r.text,'html.parser'); body=html_text(r.text)
        h1=s.find('h1'); title=h1.get_text(' ',strip=True) if h1 else ''
        if not title:
            ogt=s.find('meta',property='og:title'); title=ogt.get('content','') if ogt else ''
        title=re.sub(r'\s*:\s*opiniones.*$','',title,flags=re.I).strip()
        if not title or len(body)<80:return None
        cats=categories_for(title,body,hints)
        if not cats:return None
        og=s.find('meta',property='og:image'); image=og.get('content') if og and og.get('content') else None
        return {
            'id':hashlib.sha1(r.url.encode()).hexdigest()[:16], 'title':title,'city':city,'region':region,'categories':cats,
            'source':'Minube','source_kind':'travel-community','url':r.url,'image':image,'summary':first(body,620),
            'history':sentence_with(body,['siglo','historia','origen','constru','fundad','romano','árabe','arabe','medieval']),
            'hours':sentence_with(body,['horario','abre','abierto','cierra','entrada','visita']),
            'restrictions':sentence_with(body,['prohib','no se puede','acceso','cerrado','restric']),
            'rating':num(r'([0-5](?:[\.,]\d+)?)\s*/\s*5',body,0),'review_count':int(num(r'\((\d+)\s+valoraciones?\)',body,0)),
            'contributors':int(num(r'(\d+)\s+colaboradores?',body,0)),'likes':int(num(r'(\d+)\s+likes?',body,0)),
            'source_live_2026':True,'lat':None,'lng':None,'evidence':[]
        }
    except Exception:return None


def minube_links(city,slug):
    base=f'https://www.minube.com/espana/{slug}'; r=get(base); s=BeautifulSoup(r.text,'html.parser'); links=[]; pos={}
    def add(u,hints):
        if '/rincon/' not in u:return
        u=urljoin(base,u)
        if u in pos: links[pos[u]][1].update(hints)
        else: pos[u]=len(links);links.append([u,set(hints)])
    for a in s.select('a[href*="/rincon/"]'):add(a.get('href',''),set())
    catpages=[]
    for a in s.select('a[href*="/categorias/"]'):
        label=norm(a.get_text(' ',strip=True)+' '+a.get('href',''))
        matched={cat for cat,hints in MINUBE_HINTS.items() if any(norm(h) in label for h in hints)}
        if matched:catpages.append((urljoin(base,a.get('href','')),matched))
    for cu,hints in catpages[:5]:
        try:
            cs=BeautifulSoup(get(cu).text,'html.parser')
            for a in cs.select('a[href*="/rincon/"]'):add(a.get('href',''),hints)
        except Exception:pass
    return links[:16],base


def current2026(text):
    if not text:return ''
    if str(YEAR) not in text:return ''
    return text[:180000]


def forum_corpus(city,source,url):
    try:
        r=get(url); text=current2026(html_text(r.text)); return {'source':source,'url':r.url,'text':text,'ok':True}
    except Exception as e:return {'source':source,'url':url,'text':'','ok':False,'error':str(e)}


def collect_reddit():
    repo=Path('vendor/reddit-json-scraper/reddit_scraper.py')
    posts=[]; status=[]
    if not repo.exists():return posts,[{'source':'Reddit JSON Scraper','ok':False,'error':'repository not cloned'}]
    sys.path.insert(0,str(repo.parent))
    spec=importlib.util.spec_from_file_location('reddit_scraper',repo);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    scraper=mod.RedditJSONScraper(output_dir='/tmp/reddit-ar',user_agent=UA)
    for sub in REDDIT_SUBS:
        try:
            rows=scraper.fetch_subreddit(sub,sort='top',time_filter='year',limit=45); kept=0
            for d in rows:
                created=dt.datetime.fromtimestamp(d.get('created_utc',0),dt.timezone.utc)
                if created.year!=YEAR:continue
                posts.append({'title':d.get('title',''),'text':d.get('selftext',''),'score':int(d.get('score',0) or 0),'comments':int(d.get('num_comments',0) or 0),'date':created.date().isoformat(),'url':'https://www.reddit.com'+d.get('permalink',''),'subreddit':sub});kept+=1
            status.append({'source':f'Reddit r/{sub}','ok':True,'items_2026':kept})
        except Exception as e:status.append({'source':f'Reddit r/{sub}','ok':False,'error':str(e)})
    return posts,status


def collect_blogs():
    arts=[];status=[]
    for name,index in BLOG_INDEXES:
        try:
            r=get(index);s=BeautifulSoup(r.text,'html.parser');urls=[]
            for a in s.select('a[href]'):
                u=urljoin(r.url,a.get('href',''))
                if urlparse(u).netloc!=urlparse(r.url).netloc or u.rstrip('/')==r.url.rstrip('/'):continue
                if u not in urls and len(a.get_text(' ',strip=True))>8:urls.append(u)
            found=0
            for u in urls[:22]:
                try:
                    rr=get(u);body=html_text(rr.text)
                    if str(YEAR) not in body[:4000] and not re.search(rf'\b{YEAR}\b',rr.text[:16000]):continue
                    bs=BeautifulSoup(rr.text,'html.parser');h=bs.find('h1');title=h.get_text(' ',strip=True) if h else (bs.title.get_text(' ',strip=True) if bs.title else '')
                    og=bs.find('meta',property='og:image');arts.append({'source':name,'url':rr.url,'title':title,'text':body,'image':og.get('content') if og and og.get('content') else None});found+=1
                    if found>=8:break
                except Exception:pass
            status.append({'source':name,'ok':True,'items_2026':found,'url':r.url})
        except Exception as e:status.append({'source':name,'ok':False,'error':str(e),'url':index})
    return arts,status


def evidence_for(item, city_forums, reddit_posts, blogs):
    key=norm(item['title']); words=[w for w in key.split() if len(w)>3 and w not in {'playa','mirador','iglesia','parque','museo','calle','plaza','castillo'}]; needle=' '.join(words[:4]) or key
    ev=[];rs=0;rc=0
    for f in city_forums:
        if f.get('ok') and needle and needle in norm(f.get('text','')):ev.append({'source':f['source'],'url':f['url'],'date':str(YEAR),'excerpt':f'Mención localizada en {f["source"]} durante la sincronización {YEAR}.'})
    for p in reddit_posts:
        pn=norm(p['title']+' '+p['text'])
        if needle and needle in pn:
            ev.append({'source':f'Reddit r/{p["subreddit"]}','url':p['url'],'date':p['date'],'score':p['score'],'comments':p['comments'],'excerpt':first(p['title']+'. '+p['text'],340)});rs+=max(0,p['score']);rc+=max(0,p['comments'])
    for a in blogs:
        if needle and needle in norm(a['title']+' '+a['text']):ev.append({'source':a['source'],'url':a['url'],'date':str(YEAR),'excerpt':first(a['title']+'. '+a['text'],340)})
    uniq=[];seen=set()
    for e in ev:
        if e['url'] in seen:continue
        seen.add(e['url']);uniq.append(e)
    item['evidence']=uniq[:12];item['mentions_2026']=len(uniq);item['reddit_score_2026']=rs;item['reddit_comments_2026']=rc
    base=math.log1p(item.get('contributors',0))*14+item.get('rating',0)*9+math.log1p(item.get('review_count',0))*11+math.log1p(item.get('likes',0))*8
    fresh=len(uniq)*25+math.log1p(rs)*8+math.log1p(rc)*5
    item['community_score']=round(base+fresh,1);return item


def geocode(item):
    try:
        u='https://nominatim.openstreetmap.org/search?q='+quote(f"{item['title']}, {item['city']}, España")+'&format=jsonv2&limit=1&countrycodes=es'
        rows=get(u).json()
        if rows:item['lat']=float(rows[0]['lat']);item['lng']=float(rows[0]['lon'])
    except Exception:pass
    return item


def main():
    OUT.parent.mkdir(parents=True,exist_ok=True);start=dt.datetime.now(dt.timezone.utc);source_status=[];all_items=[]
    reddit_posts,reddit_status=collect_reddit();source_status.append({'city':'GLOBAL','region':'GLOBAL','sources':reddit_status})
    blogs,blog_status=collect_blogs();source_status.append({'city':'GLOBAL','region':'GLOBAL','sources':blog_status})
    for city,region,slug in CITIES:
        st={'city':city,'region':region,'sources':[]}
        try:links,base=minube_links(city,slug);st['sources'].append({'source':'Minube','ok':True,'candidates':len(links),'url':base})
        except Exception as e:links=[];st['sources'].append({'source':'Minube','ok':False,'error':str(e)})
        forums=[
            forum_corpus(city,'LosViajeros','https://www.losviajeros.com/foros.php?st='+quote(city)),
            forum_corpus(city,'Furgovw','https://www.furgovw.org/foro/index.php?action=search2;search='+quote(city+' viaje ruta camper')),
        ]
        st['sources'].extend([{k:v for k,v in f.items() if k!='text'}|{'bytes_2026':len(f.get('text',''))} for f in forums])
        parsed=[]
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
            for x in ex.map(lambda a:parse_minube(a[0],city,region,a[1]),links):
                if x:parsed.append(x)
        for item in parsed:evidence_for(item,forums,reddit_posts,blogs)
        parsed.sort(key=lambda x:x.get('community_score',0),reverse=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:parsed=list(ex.map(geocode,parsed[:14]))
        all_items.extend(parsed);source_status.append(st)
    merged={}
    for x in all_items:
        k=(norm(x['city']),norm(x['title']))
        if k not in merged or x.get('community_score',0)>merged[k].get('community_score',0):merged[k]=x
    items=sorted(merged.values(),key=lambda x:(x['region'],x['city'],-x.get('community_score',0)))
    result={'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'year':YEAR,'policy':'Traveler-community discovery only. Minube identifies community places; LosViajeros, Reddit via 0anxt/reddit-json-scraper, Furgovw and active 2026 camper/travel blogs add current evidence. Nominatim only geocodes selected places. Wikipedia and generic OSM POI discovery are not used.','sources':['Minube','LosViajeros','Reddit via 0anxt/reddit-json-scraper','Furgovw']+[x[0] for x in BLOG_INDEXES],'items':items,'stats':{'cities':len({x['city'] for x in items}),'items':len(items),'items_with_2026_evidence':sum(1 for x in items if x.get('mentions_2026',0)>0),'duration_seconds':round((dt.datetime.now(dt.timezone.utc)-start).total_seconds(),1)}}
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');STATUS_OUT.write_text(json.dumps({'generated_at':result['generated_at'],'status':source_status},ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result['stats'],ensure_ascii=False))

if __name__=='__main__':main()
