#!/usr/bin/env python3
"""Fetch upcoming launches from Launch Library 2 and write a trimmed JSON cache."""
from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=30&mode=detailed"
OUT = Path(__file__).resolve().parents[1] / "data" / "launches.json"

# Fallback vehicle blurbs when LL2 configuration.description is empty.
VEHICLE_FALLBACKS = {
    "falcon 9": "Falcon 9 is SpaceX’s two-stage, partially reusable orbital launch vehicle. Its first stage lands for reuse; the second stage delivers satellites and Dragon spacecraft to orbit.",
    "falcon heavy": "Falcon Heavy is SpaceX’s heavy-lift rocket: a strengthened Falcon 9 core flanked by two Falcon 9 first-stage boosters, all designed to land and be reused.",
    "starship": "Starship is SpaceX’s fully reusable two-stage system—Super Heavy booster and Starship upper stage—intended for crew and cargo to Earth orbit, the Moon, and Mars.",
    "electron": "Electron is Rocket Lab’s small orbital rocket, about 18 m tall, using Rutherford engines and carbon-composite tanks to loft small satellites to LEO and SSO.",
    "neutron": "Neutron is Rocket Lab’s medium-lift reusable rocket under development, designed for larger satellite constellations and potential human-rated missions.",
    "vulcan": "Vulcan Centaur is United Launch Alliance’s next-generation launch vehicle, using two BE-4 methane engines on the first stage and a Centaur V upper stage.",
    "atlas v": "Atlas V is ULA’s workhorse expendable rocket, pairing an RD-180-powered first stage with a Centaur upper stage and optional solid rocket boosters.",
    "new glenn": "New Glenn is Blue Origin’s heavy-lift partially reusable rocket, with a reusable first stage powered by seven BE-4 engines and a large fairing for big payloads.",
    "ariane 6": "Ariane 6 is Europe’s modular expendable launch vehicle from Arianespace/ESA, offered in Ariane 62 and Ariane 64 configurations with solid boosters.",
    "vega": "Vega C is Arianespace’s small-to-medium European launcher for polar and Sun-synchronous orbits, evolved from the original Vega with a larger first stage.",
    "h3": "H3 is JAXA and Mitsubishi Heavy Industries’ Japanese flagship rocket, succeeding H-IIA with improved cost and payload flexibility.",
    "pslv": "PSLV (Polar Satellite Launch Vehicle) is ISRO’s versatile four-stage rocket for polar and Sun-synchronous orbits, widely used for Earth-observation satellites.",
    "gslv": "GSLV is ISRO’s Geosynchronous Satellite Launch Vehicle family for geostationary transfer orbits, including the cryogenic-upper-stage Mk II.",
    "lvm3": "LVM3 (Launch Vehicle Mark-3), formerly GSLV Mk III, is ISRO’s heavy-lift rocket for GTO and crewed Gaganyaan missions.",
    "long march": "Long March (Chang Zheng) is China’s family of orbital launch vehicles operated primarily by CASC, covering LEO through GTO missions across many variants.",
    "soyuz": "Soyuz is Russia’s long-serving medium-lift family (including Soyuz-2), known for crewed flights to the ISS and a wide range of satellite launches.",
}


def vehicle_key(name: str) -> str:
    n = (name or "").lower()
    if "falcon heavy" in n:
        return "falcon-heavy"
    if "falcon 9" in n or n.startswith("falcon"):
        return "falcon9"
    if "starship" in n or "super heavy" in n:
        return "starship"
    if "electron" in n:
        return "electron"
    if "neutron" in n:
        return "neutron"
    if "vulcan" in n:
        return "vulcan"
    if "atlas v" in n or "atlas 5" in n:
        return "atlas5"
    if "new glenn" in n:
        return "new-glenn"
    if "ariane" in n:
        return "ariane6"
    if "vega" in n:
        return "vega"
    if n.startswith("h3") or " h3" in f" {n}":
        return "h3"
    if "pslv" in n:
        return "pslv"
    if "lvm3" in n or "gslv mk iii" in n or "gslv mk iii" in n or "mark-3" in n or "mk iii" in n:
        return "lvm3"
    if "gslv" in n:
        return "gslv"
    if "long march" in n or "chang zheng" in n:
        return "long-march"
    if "soyuz" in n:
        return "soyuz"
    return "generic"


def fallback_desc(name: str) -> str:
    n = (name or "").lower()
    for key, text in VEHICLE_FALLBACKS.items():
        if key in n:
            return text
    return "Orbital launch vehicle. Details from the operator’s published configuration."


def trim_launch(r: dict) -> dict:
    cfg = ((r.get("rocket") or {}).get("configuration")) or {}
    mission = r.get("mission") or {}
    pad = r.get("pad") or {}
    loc = pad.get("location") or {}
    lsp = r.get("launch_service_provider") or {}
    status = r.get("status") or {}
    orbit = mission.get("orbit") or {}
    net_prec = r.get("net_precision") or {}

    vehicle_name = cfg.get("full_name") or cfg.get("name") or "Unknown vehicle"
    vdesc = (cfg.get("description") or "").strip()
    if len(vdesc) < 40:
        vdesc = fallback_desc(vehicle_name)

    mdesc = (mission.get("description") or "").strip()
    if not mdesc:
        mdesc = (mission.get("name") or r.get("name") or "Upcoming orbital launch.").strip()

    vids = []
    for v in r.get("vid_urls") or []:
        url = v.get("url")
        if not url:
            continue
        vids.append(
            {
                "url": url,
                "title": v.get("title") or v.get("publisher") or "Webcast",
                "type": ((v.get("type") or {}).get("name")),
            }
        )
        if len(vids) >= 3:
            break

    loc_name = loc.get("name") or ""
    pad_name = pad.get("name") or ""
    vandenberg = "vandenberg" in loc_name.lower() or "vandenberg" in pad_name.lower()

    image = None
    img = r.get("image") or {}
    if isinstance(img, dict) and img.get("thumbnail_url"):
        image = {
            "url": img.get("thumbnail_url") or img.get("image_url"),
            "credit": img.get("credit"),
        }

    return {
        "id": r.get("id"),
        "name": r.get("name"),
        "slug": r.get("slug"),
        "net": r.get("net"),
        "window_start": r.get("window_start"),
        "window_end": r.get("window_end"),
        "status": {
            "id": status.get("id"),
            "name": status.get("name"),
            "abbrev": status.get("abbrev"),
        },
        "net_precision": {
            "abbrev": net_prec.get("abbrev"),
            "name": net_prec.get("name"),
        },
        "provider": lsp.get("name") or lsp.get("abbrev"),
        "provider_abbrev": lsp.get("abbrev"),
        "vehicle": {
            "name": vehicle_name,
            "family": vehicle_key(vehicle_name),
            "description": vdesc[:900],
            "length_m": cfg.get("length"),
            "diameter_m": cfg.get("diameter"),
        },
        "mission": {
            "name": mission.get("name") or (r.get("name") or "").split("|")[-1].strip(),
            "type": mission.get("type"),
            "description": mdesc[:1200],
            "orbit": orbit.get("name") or orbit.get("abbrev"),
            "orbit_abbrev": orbit.get("abbrev"),
        },
        "pad": {
            "name": pad_name,
            "location": loc_name,
            "country_code": loc.get("country_code")
            or ((loc.get("country") or {}).get("alpha_2_code") if isinstance(loc.get("country"), dict) else None),
        },
        "vandenberg": vandenberg,
        "webcasts": vids,
        "webcast_live": bool(r.get("webcast_live")),
        "image": image,
        "probability": r.get("probability"),
    }


def fetch() -> dict:
    req = urllib.request.Request(API, headers={"User-Agent": "ObjectsInSpace-EscapeVelocity/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = json.load(resp)
    launches = [trim_launch(r) for r in raw.get("results") or []]
    return {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "https://ll.thespacedevs.com/2.3.0/",
        "count": len(launches),
        "launches": launches,
    }


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Prefer stdin/file for offline regen; else live fetch
    if len(sys.argv) > 1:
        data_in = json.load(open(sys.argv[1]))
        payload = {
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "https://ll.thespacedevs.com/2.3.0/",
            "count": 0,
            "launches": [trim_launch(r) for r in data_in.get("results") or []],
        }
        payload["count"] = len(payload["launches"])
    else:
        payload = fetch()

    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if OUT.exists():
        try:
            prev = json.loads(OUT.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prev = None
        if prev is not None and prev.get("launches") == payload.get("launches"):
            print("No launch data changes")
            return 0
    OUT.write_text(text, encoding="utf-8")
    print(f"Wrote {OUT} ({payload['count']} launches)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
