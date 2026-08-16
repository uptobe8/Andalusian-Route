#!/usr/bin/env python3
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "vendor" / "park4night-mcp" / "server.py"
OUT = ROOT / "data" / "park4night-live.json"

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


def extract_text(result):
    chunks = []
    for item in getattr(result, "content", []) or []:
        text = getattr(item, "text", None)
        if text:
            chunks.append(text)
    return "\n".join(chunks)


def parse_places(text):
    starts = list(ENTRY_RE.finditer(text))
    places = []
    for idx, m in enumerate(starts):
        block_start = m.start()
        block_end = starts[idx + 1].start() if idx + 1 < len(starts) else len(text)
        block = text[block_start:block_end].strip()
        name, category = m.group(1).strip(), m.group(2).strip()
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
            "name": name,
            "category": category,
            "rating": float(detail.group(1)) if detail and detail.group(1) else None,
            "num_reviews": int(detail.group(2)) if detail and detail.group(2) else None,
            "distance_km": float(detail.group(3)) if detail else None,
            "price": detail.group(4).strip() if detail else None,
            "amenities": amenities_match.group(1).strip() if amenities_match else None,
            "location": location_line,
            "url": f"https://park4night.com/es/place/{place_id}" if place_id else None,
            "source": "Park4Night MCP"
        })
    return places


async def main():
    if not SERVER.exists():
        raise SystemExit(f"Missing MCP server: {SERVER}")
    params = StdioServerParameters(command=sys.executable, args=[str(SERVER)])
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Beba-ai-ml/park4night-mcp via MCP stdio",
        "tool": "search_places",
        "radius_km": 14,
        "anchors": []
    }
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for anchor in ANCHORS:
                result = await session.call_tool("search_places", arguments={
                    "latitude": anchor["lat"],
                    "longitude": anchor["lng"],
                    "radius_km": 14.0,
                })
                text = extract_text(result)
                places = parse_places(text)
                payload["anchors"].append({**anchor, "places": places, "count": len(places)})
                print(anchor["name"], len(places))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
