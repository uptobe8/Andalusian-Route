#!/usr/bin/env python3
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "vendor" / "park4night-mcp" / "server.py"
OUT = ROOT / "data" / "park4night-live.json"
RADIUS = 14.0
GUEST_API = "https://guest.park4night.com/services/V4.1/lieuxGetFilter.php"

ANCHORS = [
    {"name":"Granada","lat":37.1773,"lng":-3.5986},
    {"name":"Nerja","lat":36.7469,"lng":-3.8794},
    {"name":"Málaga","lat":36.7213,"lng":-4.4214},
    {"name":"Ronda","lat":36.7462,"lng":-5.1612},
    {"name":"Tarifa","lat":36.0143,"lng":-5.6044},
    {"name":"Bolonia","lat":36.0806,"lng":-5.7608},
    {"name":"Conil de la Frontera","lat":36.2773,"lng":-6.0887},
    {"name":"El Palmar","lat":36.2219,"lng":-6.0672},
    {"name":"Los Caños de Meca","lat":36.1848,"lng":-6.0109},
    {"name":"Vejer de la Frontera","lat":36.2527,"lng":-5.9675},
    {"name":"Cádiz","lat":36.5271,"lng":-6.2886},
    {"name":"Jerez de la Frontera","lat":36.6850,"lng":-6.1261},
    {"name":"Sevilla","lat":37.3891,"lng":-5.9845},
    {"name":"Córdoba","lat":37.8882,"lng":-4.7794},
    {"name":"Jaén","lat":37.7796,"lng":-3.7849},
    {"name":"Almería","lat":36.8340,"lng":-2.4637},
    {"name":"Huelva","lat":37.2614,"lng":-6.9447},
    {"name":"Almuñécar","lat":36.7339,"lng":-3.6907},
]

ENTRY_RE = re.compile(r"^\d+\. \*\*(.*?)\*\* \[(.*?)\]$", re.M)
DETAIL_RE = re.compile(r"(?:(?:★([0-9.]+))|(?:no rating))\s*(?:\((\d+) reviews\))?\s*\|\s*([0-9.]+)km away\s*\|\s*([^\n]+)")
URL_RE = re.compile(r"https://park4night\.com/(?:en|es)/place/(\d+)")
TYPE_LABELS = {
    "P":"Parking día/noche","CP":"Parking día/noche","PN":"Naturaleza","BP":"Fuera de ruta",
    "AP":"Picnic","APN":"Picnic","OR":"Área pernocta","AR":"Área descanso","PI":"Punto de interés",
    "ACS":"Área autocaravanas","ACC_P":"Área autocaravanas","ACC_PR":"Área privada","C":"Camping","CC":"Camping",
}
SERVICE_KEYS = {
    "point_eau":"Agua","eau_noire":"Aguas negras","eau_usee":"Aguas grises","wc_public":"WC",
    "poubelle":"Basura","douche":"Ducha","boulangerie":"Panadería","electricite":"Electricidad",
    "wifi":"WiFi","laverie":"Lavandería","point_de_vue":"Mirador","baignade":"Baño","windsurf":"Windsurf",
    "vtt":"BTT","rando":"Senderismo"
}


def extract_text(result):
    return "\n".join(getattr(item, "text", "") for item in (getattr(result, "content", []) or []) if getattr(item, "text", None))


def parse_mcp_places(text):
    starts = list(ENTRY_RE.finditer(text))
    places = []
    for idx, m in enumerate(starts):
        block_end = starts[idx + 1].start() if idx + 1 < len(starts) else len(text)
        block = text[m.start():block_end].strip()
        detail = DETAIL_RE.search(block)
        url_match = URL_RE.search(block)
        amenities_match = re.search(r"Amenities:\s*([^\n]+)", block)
        location_line = ""
        for line in block.splitlines()[1:]:
            if "park4night.com/" in line:
                location_line = line.split("|")[0].strip()
                break
        place_id = int(url_match.group(1)) if url_match else None
        places.append({
            "id": place_id,
            "name": m.group(1).strip(),
            "category": m.group(2).strip(),
            "rating": float(detail.group(1)) if detail and detail.group(1) else None,
            "num_reviews": int(detail.group(2)) if detail and detail.group(2) else None,
            "distance_km": float(detail.group(3)) if detail else None,
            "price": detail.group(4).strip() if detail else None,
            "amenities": amenities_match.group(1).strip() if amenities_match else None,
            "location": location_line,
            "url": f"https://park4night.com/es/place/{place_id}" if place_id else None,
            "photo": None,
            "description": None,
            "source": "Park4Night MCP"
        })
    return places


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_guest_place(p):
    place_id = p.get("id")
    photos = p.get("photos") or []
    services = [label for key, label in SERVICE_KEYS.items() if str(p.get(key, "0")) == "1"]
    desc = p.get("description_es") or p.get("description_en") or p.get("description_fr") or ""
    return {
        "id": int(place_id) if str(place_id).isdigit() else place_id,
        "name": p.get("name") or p.get("titre") or "Lugar Park4Night",
        "category": TYPE_LABELS.get(p.get("code"), p.get("code") or "Park4Night"),
        "rating": to_float(p.get("note_moyenne")),
        "num_reviews": int(p.get("nb_commentaires") or 0) or None,
        "distance_km": to_float(p.get("distance")),
        "price": p.get("prix_stationnement") or "",
        "amenities": ", ".join(services) if services else None,
        "location": ", ".join(x for x in [p.get("ville"), p.get("pays")] if x),
        "url": f"https://park4night.com/es/place/{place_id}" if place_id else "https://park4night.com/es",
        "photo": (photos[0].get("link_thumb") or photos[0].get("link_large")) if photos and isinstance(photos[0], dict) else None,
        "description": re.sub(r"<[^>]+>", "", str(desc)).strip()[:350] or None,
        "latitude": to_float(p.get("latitude")),
        "longitude": to_float(p.get("longitude")),
        "code": p.get("code"),
        "source": "Park4Night guest API fallback"
    }


async def guest_places(client, anchor):
    r = await client.get(GUEST_API, params={"latitude": anchor["lat"], "longitude": anchor["lng"]})
    r.raise_for_status()
    raw = r.json()
    rows = raw.get("lieux", raw.get("places", [])) if isinstance(raw, dict) else raw
    if not isinstance(rows, list):
        return []
    places = [normalize_guest_place(p) for p in rows if isinstance(p, dict)]
    places = [p for p in places if p.get("distance_km") is None or p["distance_km"] <= RADIUS]
    # First natural/off-grid/free-style places, campings at the bottom.
    rank = {"PN":0,"BP":1,"OR":2,"APN":3,"AP":4,"P":5,"CP":6,"AR":7,"ACS":8,"ACC_P":9,"ACC_PR":10,"C":20,"CC":20}
    places.sort(key=lambda p: (rank.get(p.get("code"), 12), -(p.get("rating") or 0), p.get("distance_km") or 999))
    return places[:40]


async def main():
    if not SERVER.exists():
        raise SystemExit(f"Missing MCP server: {SERVER}")
    params = StdioServerParameters(command=sys.executable, args=[str(SERVER)])
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Beba-ai-ml/park4night-mcp via MCP stdio; automatic real guest API fallback if current MCP upstream returns 403",
        "tool": "search_places",
        "radius_km": RADIUS,
        "anchors": []
    }
    async with httpx.AsyncClient(timeout=20.0, headers={"User-Agent":"Andalusian-Roude/1.0","Accept":"application/json,*/*"}) as http:
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                for anchor in ANCHORS:
                    result = await session.call_tool("search_places", arguments={
                        "latitude": anchor["lat"],
                        "longitude": anchor["lng"],
                        "radius_km": RADIUS,
                    })
                    places = parse_mcp_places(extract_text(result))
                    mode = "mcp"
                    if not places:
                        places = await guest_places(http, anchor)
                        mode = "guest-api-fallback"
                    payload["anchors"].append({**anchor, "mode": mode, "places": places, "count": len(places)})
                    print(anchor["name"], mode, len(places))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
