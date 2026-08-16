from __future__ import annotations

import concurrent.futures
import datetime as dt
import hashlib
import json
import math
import os
import re
import time
import unicodedata
from dataclasses import dataclass, asdict
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
import trafilatura

YEAR = 2026
OUT = Path("data/community-index.json")
STATUS_OUT = Path("data/community-source-status.json")
UA = "AndalusianRoude/1.0 traveler-community-index (+https://github.com/uptobe8/Andalusian-Route)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9,en;q=0.5"})
TIMEOUT = 18

CITIES = [
    ("Málaga", "Andalucía", "malaga"), ("Granada", "Andalucía", "granada"),
    ("Sevilla", "Andalucía", "sevilla"), ("Córdoba", "Andalucía", "cordoba"),
    ("Cádiz", "Andalucía", "cadiz"), ("Tarifa", "Andalucía", "tarifa"),
    ("Conil de la Frontera", "Andalucía", "conil_de_la_frontera"), ("Nerja", "Andalucía", "nerja"),
    ("Ronda", "Andalucía", "ronda"), ("Almería", "Andalucía", "almeria"),
    ("Huelva", "Andalucía", "huelva"), ("Jaén", "Andalucía", "jaen"),
    ("Jerez de la Frontera", "Andalucía", "jerez_de_la_frontera"), ("Marbella", "Andalucía", "marbella"),
    ("Cáceres", "Extremadura", "caceres"), ("Mérida", "Extremadura", "merida"),
    ("Badajoz", "Extremadura", "badajoz"), ("Trujillo", "Extremadura", "trujillo"),
    ("Barcelona", "Cataluña", "barcelona"), ("Girona", "Cataluña", "girona"),
    ("Tarragona", "Cataluña", "tarragona"), ("Lleida", "Cataluña", "lleida"),
    ("Cadaqués", "Cataluña", "cadaques"), ("Sitges", "Cataluña", "sitges"),
    ("Valencia", "Comunitat Valenciana", "valencia"), ("Alicante", "Comunitat Valenciana", "alicante"),
    ("Murcia", "Región de Murcia", "murcia"), ("Cartagena", "Región de Murcia", "cartagena"),
    ("Madrid", "Comunidad de Madrid", "madrid"), ("Toledo", "Castilla-La Mancha", "toledo"),
]

BLOG_INDEXES = [
    ("Autocamperly", "https://autocamperly.com/blog/"),
    ("Alhambra Camper", "https://alhambracamper.com/blog/"),
    ("Alas de Ruta", "https://alasderuta.com/blog/"),
    ("WalabiCamper", "https://walabicamper.com/blog/"),
    ("Áreas Autocaravanas Andalucía", "https://areasautocaravanasandalucia.com/diario-de-viaje/"),
    ("Furgocasa", "https://www.furgocasa.com/es/blog"),
]

REDDIT_ALLOWED = {
    "travel", "solotravel", "goingtospain", "spain", "backpacking", "campervans",
    "vanlife", "digitalnomad", "roadtrip", "surfing", "askspain", "andalucia",
}

CATEGORY_TERMS = {
    "playas": ["playa", "playas", "cala", "calas", "beach", "arena", "mar"],
    "monumentos": ["monumento", "castillo", "alcazaba", "catedral", "iglesia", "museo", "torre", "puente", "romano", "histórico", "historico"],
    "miradores": ["mirador", "balcón", "balcon", "panorámica", "panoramica", "vistas", "viewpoint"],
    "surf": ["surf", "kitesurf", "windsurf", "olas", "spot"],
    "atardecer": ["atardecer", "puesta de sol", "ocaso", "sunset", "hora dorada"],
    "actividades": ["actividad", "kayak", "barco", "senderismo", "ruta", "buceo", "snorkel", "bicicleta", "aventura", "excursión", "excursion"],
    "gastro": ["chiringuito", "restaurante", "taberna", "bar", "mercado", "tapas", "tapeo", "espetos", "gastronomía", "gastronomia"],
    "naturaleza": ["parque natural", "sierra", "reserva", "cueva", "desfiladero", "sendero", "bosque", "duna", "acantilado", "naturaleza"],
    "pueblos": ["pueblo", "casco antiguo", "villa", "aldea", "barrio histórico", "barrio historico"],
}

MINUBE_LINK_HINTS = {
    "playas": ["playa", "calas"], "monumentos": ["monument", "igles", "castill", "cultura"],
    "miradores": ["mirador"], "gastro": ["restaur", "gastr", "mercado"],
    "naturaleza": ["aire-libre", "natur", "parque", "rutas"], "actividades": ["actividad", "aventura", "entreten"],
    "pueblos": ["pueblos"],
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-zA-Z0-9ñÑáéíóúüÁÉÍÓÚÜ ]+", " ", s)).strip().lower()


def get(url: str, **kwargs):
    r = SESSION.get(url, timeout=TIMEOUT, allow_redirects=True, **kwargs)
    r.raise_for_status()
    return r


def soup(url: str):
    r = get(url)
    return BeautifulSoup(r.text, "html.parser"), r.text, r.url


def text_from_html(html: str) -> str:
    txt = trafilatura.extract(html, include_links=False, include_images=False, include_comments=True, output_format="txt")
    return re.sub(r"\s+", " ", txt or "").strip()


def first_sentence(text: str, max_len=520) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= max_len:
        return text
    cut = text[:max_len].rsplit(" ", 1)[0]
    return cut + "…"


def sentence_with(text: str, terms: list[str], fallback="") -> str:
    for sentence in re.split(r"(?<=[.!?])\s+", text or ""):
        n = norm(sentence)
        if any(norm(t) in n for t in terms) and 30 <= len(sentence) <= 700:
            return sentence.strip()
    return fallback


def categories_for(title: str, body: str, source_categories: set[str]) -> list[str]:
    n = norm(title + " " + body)
    cats = set(source_categories)
    for cat, terms in CATEGORY_TERMS.items():
        if any(norm(t) in n for t in terms):
            cats.add(cat)
    # Sunset must be explicitly discussed; a generic viewpoint is not a sunset recommendation.
    if "atardecer" in cats and not any(norm(t) in n for t in CATEGORY_TERMS["atardecer"]):
        cats.discard("atardecer")
    # Surf and gastro also require explicit evidence.
    for strict in ("surf", "gastro"):
        if strict in cats and not any(norm(t) in n for t in CATEGORY_TERMS[strict]):
            cats.discard(strict)
    return sorted(cats)


def parse_number(pattern: str, text: str, default=0):
    m = re.search(pattern, text, re.I)
    if not m:
        return default
    try:
        return float(m.group(1).replace(",", "."))
    except Exception:
        return default


def parse_minube_place(url: str, city: str, region: str, source_categories: set[str]):
    try:
        s, html, final_url = soup(url)
        title = (s.find("h1").get_text(" ", strip=True) if s.find("h1") else "").strip()
        if not title:
            title = (s.find("meta", property="og:title") or {}).get("content", "").strip()
        title = re.sub(r"\s*:\s*opiniones.*$", "", title, flags=re.I)
        body = text_from_html(html)
        if not title or len(body) < 80:
            return None
        og = s.find("meta", property="og:image")
        image = og.get("content") if og and og.get("content") else None
        rating = parse_number(r"([0-5](?:[\.,]\d+)?)\s*/\s*5", body, 0)
        reviews = int(parse_number(r"\((\d+)\s+valoraciones?\)", body, 0))
        contributors = int(parse_number(r"(\d+)\s+colaboradores?", body, 0))
        likes = int(parse_number(r"(\d+)\s+likes?", body, 0))
        cats = categories_for(title, body, source_categories)
        if not cats:
            return None
        history = sentence_with(body, ["siglo", "historia", "origen", "constru", "fundad", "romano", "árabe", "arabe", "medieval"])
        hours = sentence_with(body, ["horario", "abre", "abierto", "cierra", "entrada"])
        restrictions = sentence_with(body, ["prohib", "no se puede", "acceso", "cerrado", "restric"])
        return {
            "id": hashlib.sha1(final_url.encode()).hexdigest()[:16],
            "title": title,
            "city": city,
            "region": region,
            "categories": cats,
            "source": "Minube",
            "source_kind": "travel-community",
            "url": final_url,
            "image": image,
            "summary": first_sentence(body, 620),
            "history": history,
            "hours": hours,
            "restrictions": restrictions,
            "rating": rating,
            "review_count": reviews,
            "contributors": contributors,
            "likes": likes,
            "lat": None,
            "lng": None,
            "evidence": [],
        }
    except Exception:
        return None


def minube_candidates(city: str, region: str, slug: str):
    base = f"https://www.minube.com/espana/{slug}"
    s, html, _ = soup(base)
    links: list[tuple[str, set[str]]] = []
    seen = set()
    # Direct community places from the city page.
    for a in s.select('a[href*="/rincon/"]'):
        u = urljoin(base, a.get("href", ""))
        if u and u not in seen:
            seen.add(u); links.append((u, set()))
    # Category pages are discovered from the live city page, not guessed.
    cat_urls = []
    for a in s.select('a[href*="/categorias/"]'):
        href = a.get("href", "")
        label = norm(a.get_text(" ", strip=True) + " " + href)
        matched = {cat for cat, hints in MINUBE_LINK_HINTS.items() if any(norm(h) in label for h in hints)}
        if matched:
            cat_urls.append((urljoin(base, href), matched))
    for cu, cats in cat_urls[:8]:
        try:
            cs, _, _ = soup(cu)
            for a in cs.select('a[href*="/rincon/"]'):
                u = urljoin(cu, a.get("href", ""))
                if not u:
                    continue
                if u in seen:
                    # enrich already known link with source category
                    for i, (old, oldcats) in enumerate(links):
                        if old == u:
                            links[i] = (old, oldcats | cats)
                            break
                else:
                    seen.add(u); links.append((u, set(cats)))
        except Exception:
            pass
        time.sleep(0.12)
    return links[:18]


def current_year_segments(text: str) -> str:
    chunks = re.split(r"(?=(?:Publicado|Posted|Fecha|Última modificación|Ultima modificacion)[^\n]{0,80})", text or "", flags=re.I)
    kept = [c for c in chunks if str(YEAR) in c]
    return "\n".join(kept)[:160000]


def fetch_losviajeros(city: str) -> dict:
    url = "https://www.losviajeros.com/foros.php?st=" + quote(city)
    r = get(url)
    txt = text_from_html(r.text)
    return {"source": "LosViajeros", "url": r.url, "text": current_year_segments(txt), "ok": True}


def fetch_furgovw(city: str) -> dict:
    q = quote(city + " viaje ruta")
    url = f"https://www.furgovw.org/foro/index.php?action=search2;search={q}"
    r = get(url)
    txt = text_from_html(r.text)
    return {"source": "Furgovw", "url": r.url, "text": current_year_segments(txt), "ok": True}


def fetch_reddit(city: str) -> dict:
    query = f'"{city}" (travel OR viaje OR playa OR atardecer OR tapas OR camper OR surf)'
    url = "https://www.reddit.com/search.json?q=" + quote(query) + "&sort=top&t=year&limit=40&raw_json=1"
    r = get(url, headers={"User-Agent": UA, "Accept": "application/json"})
    data = r.json()
    rows = []
    for child in data.get("data", {}).get("children", []):
        d = child.get("data", {})
        created = dt.datetime.fromtimestamp(d.get("created_utc", 0), dt.timezone.utc)
        sub = str(d.get("subreddit", "")).lower()
        if created.year != YEAR or (sub and sub not in REDDIT_ALLOWED):
            continue
        rows.append({
            "title": d.get("title", ""), "text": d.get("selftext", ""), "score": int(d.get("score", 0) or 0),
            "comments": int(d.get("num_comments", 0) or 0), "date": created.date().isoformat(),
            "url": "https://www.reddit.com" + d.get("permalink", ""), "subreddit": d.get("subreddit", ""),
        })
    corpus = "\n".join((x["title"] + " " + x["text"]) for x in rows)
    return {"source": "Reddit", "url": url, "text": corpus, "posts": rows, "ok": True}


def collect_blog_articles():
    articles = []
    statuses = []
    for name, index in BLOG_INDEXES:
        try:
            s, html, final = soup(index)
            links = []
            for a in s.select("a[href]"):
                href = urljoin(final, a.get("href", ""))
                if urlparse(href).netloc != urlparse(final).netloc:
                    continue
                label = a.get_text(" ", strip=True)
                if href.rstrip("/") == final.rstrip("/"):
                    continue
                if href not in links and len(label) > 8:
                    links.append(href)
            picked = links[:40]
            found = 0
            for u in picked:
                try:
                    rs = get(u)
                    body = text_from_html(rs.text)
                    if str(YEAR) not in body[:2500] and not re.search(rf"(?:0?[1-9]|[12]\d|3[01])[/\-.](?:0?[1-9]|1[0-2])[/\-.]{YEAR}", body[:3000]):
                        continue
                    bs = BeautifulSoup(rs.text, "html.parser")
                    title = (bs.find("h1").get_text(" ", strip=True) if bs.find("h1") else "") or (bs.title.get_text(" ", strip=True) if bs.title else "")
                    og = bs.find("meta", property="og:image")
                    image = og.get("content") if og and og.get("content") else None
                    articles.append({"source": name, "url": rs.url, "title": title, "text": body, "image": image})
                    found += 1
                    if found >= 12:
                        break
                except Exception:
                    continue
            statuses.append({"source": name, "ok": True, "items": found, "url": final})
        except Exception as e:
            statuses.append({"source": name, "ok": False, "error": str(e), "url": index})
    return articles, statuses


def evidence_for(item: dict, corpora: list[dict], blog_articles: list[dict]):
    key = norm(item["title"])
    words = [w for w in key.split() if len(w) > 3 and w not in {"playa", "mirador", "iglesia", "parque", "museo", "calle", "plaza"}]
    needle = " ".join(words[:4]) or key
    evid = []
    reddit_score = 0
    reddit_comments = 0
    for source in corpora:
        ntext = norm(source.get("text", ""))
        if needle and needle in ntext:
            if source["source"] == "Reddit":
                for p in source.get("posts", []):
                    pn = norm(p["title"] + " " + p["text"])
                    if needle in pn:
                        evid.append({"source": "Reddit", "url": p["url"], "date": p["date"], "score": p["score"], "comments": p["comments"], "excerpt": first_sentence(p["title"] + ". " + p["text"], 340)})
                        reddit_score += max(0, p["score"]); reddit_comments += max(0, p["comments"])
            else:
                evid.append({"source": source["source"], "url": source["url"], "date": str(YEAR), "excerpt": f"Mención localizada en contenido público de {source['source']} actualizado en {YEAR}."})
    for a in blog_articles:
        if needle and needle in norm(a["title"] + " " + a["text"]):
            evid.append({"source": a["source"], "url": a["url"], "date": str(YEAR), "excerpt": first_sentence(a["title"] + ". " + a["text"], 340)})
    # De-duplicate evidence URLs.
    uniq = []
    seen = set()
    for e in evid:
        if e.get("url") in seen:
            continue
        seen.add(e.get("url")); uniq.append(e)
    item["evidence"] = uniq[:12]
    item["mentions_2026"] = len(uniq)
    item["reddit_score_2026"] = reddit_score
    item["reddit_comments_2026"] = reddit_comments
    base = (math.log1p(item.get("contributors", 0)) * 14 + item.get("rating", 0) * 9 + math.log1p(item.get("review_count", 0)) * 11 + math.log1p(item.get("likes", 0)) * 8)
    fresh = len(uniq) * 22 + math.log1p(reddit_score) * 8 + math.log1p(reddit_comments) * 5
    item["community_score"] = round(base + fresh, 1)
    return item


def geocode_item(item: dict):
    try:
        q = quote(f"{item['title']}, {item['city']}, España")
        u = f"https://nominatim.openstreetmap.org/search?q={q}&format=jsonv2&limit=1&countrycodes=es"
        rows = get(u).json()
        if rows:
            item["lat"] = float(rows[0]["lat"]); item["lng"] = float(rows[0]["lon"])
    except Exception:
        pass
    return item


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    started = dt.datetime.now(dt.timezone.utc)
    source_status = []
    blog_articles, blog_status = collect_blog_articles()
    source_status.extend(blog_status)
    all_items = []

    for city, region, slug in CITIES:
        city_status = {"city": city, "region": region, "sources": []}
        try:
            links = minube_candidates(city, region, slug)
            city_status["sources"].append({"source": "Minube", "ok": True, "candidates": len(links), "url": f"https://www.minube.com/espana/{slug}"})
        except Exception as e:
            links = []
            city_status["sources"].append({"source": "Minube", "ok": False, "error": str(e)})

        corpora = []
        for fn, label in ((fetch_losviajeros, "LosViajeros"), (fetch_reddit, "Reddit"), (fetch_furgovw, "Furgovw")):
            try:
                c = fn(city); corpora.append(c)
                city_status["sources"].append({"source": label, "ok": True, "bytes": len(c.get("text", "")), "url": c.get("url")})
            except Exception as e:
                city_status["sources"].append({"source": label, "ok": False, "error": str(e)})

        parsed = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
            futs = [ex.submit(parse_minube_place, u, city, region, cats) for u, cats in links]
            for f in concurrent.futures.as_completed(futs):
                x = f.result()
                if x:
                    parsed.append(x)

        # Community relevance comes first. No OSM/Wikipedia item discovery is used here.
        for item in parsed:
            evidence_for(item, corpora, blog_articles)
        parsed.sort(key=lambda x: x.get("community_score", 0), reverse=True)
        # Geocoding is only used after a traveler-community candidate has been selected.
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
            parsed = list(ex.map(geocode_item, parsed[:16]))
        all_items.extend(parsed)
        source_status.append(city_status)
        time.sleep(0.2)

    # De-duplicate by normalized title + city.
    merged = {}
    for item in all_items:
        k = (norm(item["city"]), norm(item["title"]))
        if k not in merged or item.get("community_score", 0) > merged[k].get("community_score", 0):
            merged[k] = item
    items = sorted(merged.values(), key=lambda x: (x["region"], x["city"], -x.get("community_score", 0)))

    result = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "year": YEAR,
        "policy": "Traveler-community discovery only. OpenStreetMap/Nominatim is used solely to geocode already-selected community places; Wikipedia is not used.",
        "sources": ["Minube", "LosViajeros", "Reddit", "Furgovw"] + [x[0] for x in BLOG_INDEXES],
        "items": items,
        "stats": {
            "cities": len({x["city"] for x in items}),
            "items": len(items),
            "items_with_2026_evidence": sum(1 for x in items if x.get("mentions_2026", 0) > 0),
            "duration_seconds": round((dt.datetime.now(dt.timezone.utc) - started).total_seconds(), 1),
        },
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    STATUS_OUT.write_text(json.dumps({"generated_at": result["generated_at"], "status": source_status}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result["stats"], ensure_ascii=False))


if __name__ == "__main__":
    main()
