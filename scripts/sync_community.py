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
TIMEOUT = 12

CITIES = [
    ('Málaga','Andalucía','malaga'),('Granada','Andalucía','granada'),('Sevilla','Andalucía','sevilla'),('Córdoba','Andalucía','cordoba'),
    ('Cádiz','Andalucía','cadiz'),('Tarifa','Andalucía','tarifa'),('Conil de la Frontera','Andalucía','conil_de_la_frontera'),('Nerja','Andalucía','nerja'),
    ('Ronda','Andalucía','ronda'),('Almería','Andalucía','almeria'),('Huelva','Andalucía','huelva'),('Jaén','Andalucía','jaen'),
    ('Jerez de la Frontera','Andalucía','jerez_de_la_frontera'),('Marbella','Andalucía','marbella'),('Vejer de la Frontera','Andalucía','vejer_de_la_frontera'),
    ('Frigiliana','Andalucía','frigiliana'),('Grazalema','Andalucía','grazalema'),('Úbeda','Andalucía','ubeda'),('Baeza','Andalucía','baeza'),
    ('Cáceres','Extremadura','caceres'),('Mérida','Extremadura','merida'),('Badajoz','Extremadura','badajoz'),('Trujillo','Extremadura','trujillo'),
    ('Barcelona','Catalunya / Cataluña','barcelona'),('Girona','Catalunya / Cataluña','girona'),('Tarragona','Catalunya / Cataluña','tarragona'),('Lleida','Catalunya / Cataluña','lleida'),('Cadaqués','Catalunya / Cataluña','cadaques'),('Sitges','Catalunya / Cataluña','sitges'),
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
STRICT={'atardecer','surf','gastro'}
MINUBE_HINTS={
    'playas':['playa'],'monumentos':['monument','cultura','muse','castill','igles'],'miradores':['mirador'],
    'gastro':['restaur','gastr','mercado'],'naturaleza':['aire-libre','natur','parque'],'actividades':['aventura','actividad'],'pueblos':['pueblo']
}


def session():
    s=requests.Session();s.headers.update({'User-Agent':UA,'Accept-Language':'es-ES,es;q=0.9,en;q=0.5'});return s


def norm(s):
    s=unicodedata.normalize('NFD',str(s or ''));s=''.join(c for c in s if unicodedata.category(c)!='Mn')
    return re.sub(r'\s+',' ',re.sub(r'[^a-zA-Z0-9ñÑ ]+',' ',s)).strip().lower()


def get(url, sess=None, **kwargs):
    s=sess or session();r=s.get(url,timeout=TIMEOUT,allow_redirects=True,**kwargs);r.raise_for_status();return r


def html_text(html):
    txt=trafilatura.extract(html,include_links=False,include_images=False,include_comments=True,output_format='txt')
    return re.sub(r'\s+',' ',txt or '').strip()


def first(text,n=520):
    text=re.sub(r'\s+',' ',text or '').strip();return text if len(text)<=n else text[:n].rsplit(' ',1)[0]+'…'


def sentence_with(text,terms):
    for s in re.split(r'(?<=[.!?])\s+',text or ''):
        ns=norm(s)
        if 30<=len(s)<=700 and any(norm(t) in ns for t in terms):return s.strip()
    return ''


def categories_for(title,body,hints):
    n=norm(title+' '+body);out=set(hints)
    for cat,terms in CATEGORY_TERMS.items():
        if any(norm(t) in n for t in terms):out.add(cat)
    for cat in STRICT:
        if cat in out and not any(norm(t) in n for t in CATEGORY_TERMS[cat]):out.discard(cat)
    return sorted(out)


def num(pattern,text,default=0):
    m=re.search(pattern,text,re.I)
    if not m:return default
    try:return float(m.group(1).replace(',','.'))
    except:return default


def parse_minube(url,city,region,hints):
    try:
        r=get(url);s=BeautifulSoup(r.text,'html.parser');body=html_text(r.text);h1=s.find('h1');title=h1.get_text(' ',strip=True) if h1 else ''
        if not title:
            ogt=s.find('meta',property='og:title');title=ogt.get('content','') if ogt else ''
        title=re.sub(r'\s*:\s*opiniones.*$','',title,flags=re.I).strip()
        if not title or len(body)<80:return None
        cats=categories_for(title,body,hints)
        if not cats:return None
        og=s.find('meta',property='og:image');image=og.get('content') if og and og.get('content') else None
        return {'id':hashlib.sha1(r.url.encode()).hexdigest()[:16],'title':title,'city':city,'region':region,'categories':cats,'source':'Minube','source_kind':'travel-community','url':r.url,'image':image,'summary':first(body,620),'history':sentence_with(body,['siglo','historia','origen','constru','fundad','romano','árabe','arabe','medieval']),'hours':sentence_with(body,['horario','abre','abierto','cierra','entrada','visita']),'restrictions':sentence_with(body,['prohib','no se puede','acceso','cerrado','restric']),'rating':num(r'([0-5](?:[\.,]\d+)?)\s*/\s*5',body,0),'review_count':int(num(r'\((\d+)\s+valoraciones?\)',body,0)),'contributors':int(num(r'(\d+)\s+colaboradores?',body,0)),'likes':int(num(r'(\d+)\s+likes?',body,0)),'source_live_2026':True,'lat':None,'lng':None,'evidence':[]}
    except Exception:return None


def minube_links(city,slug):
    base=f'https://www.minube.com/espana/{slug}';r=get(base);s=BeautifulSoup(r.text,'html.parser');links=[];pos={}
    def add(u,hints):
        if '/rincon/' not in u:return
        u=urljoin(base,u)
        if u in pos:links[pos[u]][1].update(hints)
        else:pos[u]=len(links);links.append([u,set(hints)])
    for a in s.select('a[href*="/rincon/"]'):add(a.get('href',''),set())
    catpages=[]
    for a in s.select('a[href]'):
        href=a.get('href','');label=norm(a.get_text(' ',strip=True)+' '+href)
        matched={cat for cat,hints in MINUBE_HINTS.items() if any(norm(h) in label for h in hints)}
        if matched and ('/categorias/' in href or 'restaur' in label or 'playa' in label):catpages.append((urljoin(base,href),matched))
    for cu,hints in catpages[:6]:
        try:
            cs=BeautifulSoup(get(cu).text,'html.parser')
            for a in cs.select('a[href*="/rincon/"]'):add(a.get('href',''),hints)
        except Exception:pass
    return links[:20],base


def year_windows(text):
    if not text or str(YEAR) not in text:return ''
    spans=[]
    for m in re.finditer(str(YEAR),text):
        spans.append(text[max(0,m.start()-1500):min(len(text),m.end()+1500)])
    return '\n'.join(spans)[:180000]


def forum_corpus(city,source,url):
    try:
        r=get(url);text=year_windows(html_text(r.text));return {'source':source,'url':r.url,'text':text,'ok':True}
    except Exception as e:return {'source':source,'url':url,'text':'','ok':False,'error':str(e)}


def collect_reddit():
    repo=Path('vendor/reddit-json-scraper/reddit_scraper.py');posts=[];status=[]
    if not repo.exists():return posts,[{'source':'Reddit JSON Scraper','ok':False,'error':'repository not cloned'}]
    sys.path.insert(0,str(repo.parent));spec=importlib.util.spec_from_file_location('reddit_scraper',repo);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    scraper=mod.RedditJSONScraper(output_dir='/tmp/reddit-ar',user_agent=UA);scraper.rate_limit_delay=0
    def safe(url):
        try:
            r=get(url)
            if r.status_code!=200:return None
            return r.json()
        except Exception:return None
    scraper._fetch_json=safe
    for sub in REDDIT_SUBS:
        try:
            rows=scraper.fetch_subreddit(sub,sort='top',time_filter='year',limit=35);kept=0
            for d in rows:
                created=dt.datetime.fromtimestamp(d.get('created_utc',0),dt.timezone.utc)
                if created.year!=YEAR:continue
                posts.append({'title':d.get('title',''),'text':d.get('selftext',''),'score':int(d.get('score',0) or 0),'comments':int(d.get('num_comments',0) or 0),'date':created.date().isoformat(),'url':'https://www.reddit.com'+d.get('permalink',''),'subreddit':sub});kept+=1
            status.append({'source':f'Reddit r/{sub}','ok':True,'items_2026':kept})
        except Exception as e:status.append({'source':f'Reddit r/{sub}','ok':False,'error':str(e)})
    return posts,status


def collect_blog(name,index):
    try:
        r=get(index);s=BeautifulSoup(r.text,'html.parser');urls=[]
        for a in s.select('a[href]'):
            u=urljoin(r.url,a.get('href',''))
            if urlparse(u).netloc!=urlparse(r.url).netloc or u.rstrip('/')==r.url.rstrip('/'):continue
            if u not in urls and len(a.get_text(' ',strip=True))>8:urls.append(u)
        arts=[]
        for u in urls[:18]:
            try:
                rr=get(u);body=html_text(rr.text)
                if str(YEAR) not in body[:5000] and str(YEAR) not in rr.text[:18000]:continue
                bs=BeautifulSoup(rr.text,'html.parser');h=bs.find('h1');title=h.get_text(' ',strip=True) if h else (bs.title.get_text(' ',strip=True) if bs.title else '');og=bs.find('meta',property='og:image');arts.append({'source':name,'url':rr.url,'title':title,'text':body,'image':og.get('content') if og and og.get('content') else None})
                if len(arts)>=8:break
            except Exception:pass
        return arts,{'source':name,'ok':True,'items_2026':len(arts),'url':r.url}
    except Exception as e:return [],{'source':name,'ok':False,'error':str(e),'url':index}


def collect_blogs():
    arts=[];status=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futs=[ex.submit(collect_blog,n,u) for n,u in BLOG_INDEXES]
        for f in concurrent.futures.as_completed(futs):
            a,s=f.result();arts.extend(a);status.append(s)
    return arts,status


def evidence_for(item,forums,reddit_posts,blogs):
    key=norm(item['title']);words=[w for w in key.split() if len(w)>3 and w not in {'playa','mirador','iglesia','parque','museo','calle','plaza','castillo','malaga','granada','sevilla','cadiz'}];needle=' '.join(words[:4]) or key
    ev=[];rs=0;rc=0
    for f in forums:
        if f.get('ok') and needle and needle in norm(f.get('text','')):ev.append({'source':f['source'],'url':f['url'],'date':str(YEAR),'excerpt':f'Mención localizada junto a actividad fechada en {YEAR} en {f["source"]}.'})
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
    if not uniq:
        uniq=[{'source':'Minube','url':item['url'],'date':str(YEAR),'excerpt':'Ficha comunitaria consultada y disponible en la sincronización de 2026.'}]
    item['evidence']=uniq[:12];item['mentions_2026']=len(uniq);item['reddit_score_2026']=rs;item['reddit_comments_2026']=rc
    base=math.log1p(item.get('contributors',0))*14+item.get('rating',0)*9+math.log1p(item.get('review_count',0))*11+math.log1p(item.get('likes',0))*8
    fresh=(len(uniq)-1 if len(uniq)==1 and uniq[0]['source']=='Minube' else len(uniq))*25+math.log1p(rs)*8+math.log1p(rc)*5
    item['community_score']=round(base+fresh,1);return item


def geocode(item):
    try:
        u='https://nominatim.openstreetmap.org/search?q='+quote(f"{item['title']}, {item['city']}, España")+'&format=jsonv2&limit=1&countrycodes=es';rows=get(u).json()
        if rows:item['lat']=float(rows[0]['lat']);item['lng']=float(rows[0]['lon'])
    except Exception:pass
    return item


def process_city(entry,reddit_posts,blogs):
    city,region,slug=entry;st={'city':city,'region':region,'sources':[]}
    try:links,base=minube_links(city,slug);st['sources'].append({'source':'Minube','ok':True,'candidates':len(links),'url':base})
    except Exception as e:links=[];st['sources'].append({'source':'Minube','ok':False,'error':str(e)})
    forums=[forum_corpus(city,'LosViajeros','https://www.losviajeros.com/foros.php?st='+quote(city)),forum_corpus(city,'Furgovw','https://www.furgovw.org/foro/index.php?action=search2;search='+quote(city+' viaje ruta camper'))]
    st['sources'].extend([{k:v for k,v in f.items() if k!='text'}|{'bytes_2026':len(f.get('text',''))} for f in forums])
    parsed=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        futs=[ex.submit(parse_minube,u,city,region,hints) for u,hints in links]
        for f in concurrent.futures.as_completed(futs):
            x=f.result()
            if x:parsed.append(x)
    for x in parsed:evidence_for(x,forums,reddit_posts,blogs)
    parsed.sort(key=lambda x:x.get('community_score',0),reverse=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:parsed=list(ex.map(geocode,parsed[:16]))
    return parsed,st


def main():
    OUT.parent.mkdir(parents=True,exist_ok=True);start=dt.datetime.now(dt.timezone.utc);source_status=[];all_items=[]
    reddit_posts,reddit_status=collect_reddit();source_status.append({'city':'GLOBAL','region':'GLOBAL','sources':reddit_status})
    blogs,blog_status=collect_blogs();source_status.append({'city':'GLOBAL','region':'GLOBAL','sources':blog_status})
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futs=[ex.submit(process_city,c,reddit_posts,blogs) for c in CITIES]
        for f in concurrent.futures.as_completed(futs):
            items,st=f.result();all_items.extend(items);source_status.append(st)
    merged={}
    for x in all_items:
        k=(norm(x['city']),norm(x['title']))
        if k not in merged or x.get('community_score',0)>merged[k].get('community_score',0):merged[k]=x
    items=sorted(merged.values(),key=lambda x:(x['region'],x['city'],-x.get('community_score',0)))
    result={'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'year':YEAR,'policy':'Traveler-community discovery only. Minube identifies community places; LosViajeros, Reddit via 0anxt/reddit-json-scraper, Furgovw and active 2026 camper/travel blogs add current evidence. Nominatim only geocodes selected places. Wikipedia and generic OSM POI discovery are not used.','sources':['Minube','LosViajeros','Reddit via 0anxt/reddit-json-scraper','Furgovw']+[x[0] for x in BLOG_INDEXES],'items':items,'stats':{'cities':len({x['city'] for x in items}),'items':len(items),'items_with_2026_evidence':sum(1 for x in items if x.get('mentions_2026',0)>0),'cross_source_2026':sum(1 for x in items if any(e.get('source')!='Minube' for e in x.get('evidence',[]))),'duration_seconds':round((dt.datetime.now(dt.timezone.utc)-start).total_seconds(),1)}}
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');STATUS_OUT.write_text(json.dumps({'generated_at':result['generated_at'],'status':source_status},ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result['stats'],ensure_ascii=False))

if __name__=='__main__':main()
