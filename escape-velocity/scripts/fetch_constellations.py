#!/usr/bin/env python3
"""Build constellation JSON for the Escape Velocity globe views.

Sources
  - CelesTrak SATCAT (https://celestrak.org/pub/satcat.csv)
  - CelesTrak GP elements (group and/or name queries)
  - Jonathan McDowell's GCAT launch list
    (https://planet4589.org/space/gcat/tsv/launch/launch.tsv)

Output (compact, columnar), one file per constellation under data/:
  asOf, ref, built, name, insertAlt, firstLaunchLabel,
  pads, sites, launches, L, D, I, A, O, U, G, R

Approximations (documented here, not on the page):
  - Orbits are treated as circular (these constellations have very small
    eccentricity once on station).
  - Satellites with no current elements (decayed, or a few still in orbit
    without a GP record) take inclination from SATCAT, altitude from the
    median of active satellites of the same launch (or a shell default),
    and a pseudo-random RAAN/phase.
  - Satellites that decayed within 120 days of launch are treated as never
    having raised their orbit.
"""
import argparse
import csv
import io
import json
import math
import statistics
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

SATCAT_URL = "https://celestrak.org/pub/satcat.csv"
GCAT_URL = "https://planet4589.org/space/gcat/tsv/launch/launch.tsv"
GP_BASE = "https://celestrak.org/NORAD/elements/gp.php"

MU = 398600.4418
RE = 6378.137
J2 = 1.08262668e-3

# lat/lon are the pad; az is the launch-azimuth policy used for the
# insertion-trail animation (see constellation.js).
PAD_INFO = {
    "LC40":  {"name": "Cape Canaveral SLC-40", "lat": 28.5619, "lon": -80.5772, "az": "auto"},
    "LC39A": {"name": "Kennedy LC-39A", "lat": 28.6082, "lon": -80.6041, "az": "auto"},
    "SLC4E": {"name": "Vandenberg SLC-4E", "lat": 34.6321, "lon": -120.6106, "az": "south"},
    "STARB": {"name": "Starbase", "lat": 25.997, "lon": -97.157, "az": "northeast"},
    "SLC41": {"name": "Cape Canaveral SLC-41", "lat": 28.5834, "lon": -80.5829, "az": "auto"},
    "LC36":  {"name": "Cape Canaveral LC-36", "lat": 28.5313, "lon": -80.5786, "az": "auto"},
    "ELS":   {"name": "Guiana Space Centre ELS", "lat": 5.2167, "lon": -52.7750, "az": "northeast"},
    "ELA4":  {"name": "Guiana Space Centre ELA-4", "lat": 5.2650, "lon": -52.7920, "az": "northeast"},
    "LC31":  {"name": "Baikonur Site 31/6", "lat": 45.9960, "lon": 63.5640, "az": "northeast"},
    "PU1S":  {"name": "Vostochny Site 1S", "lat": 51.8845, "lon": 128.3335, "az": "northeast"},
    "SLP":   {"name": "Sriharikota SLP", "lat": 13.7199, "lon": 80.2304, "az": "south"},
}

# Starlink pad indices must stay 0=SLC-40, 1=LC-39A, 2=SLC-4E, 3=Starbase.
STARLINK_PAD_ORDER = ["LC40", "LC39A", "SLC4E", "STARB"]
STARLINK_PAD_INDEX = {"LC40": 0, "LC39A": 1, "SLC4E": 2, "STARB": 3}

# Fallback when GCAT has no pad: SATCAT site code -> pad key.
SATCAT_SITE_PAD = {
    "STARB": "STARB",
    "AFWTR": "SLC4E",
    "TYMSC": "LC31",
    "VOSTO": "PU1S",
    "SRILR": "SLP",
}


def is_starlink(r):
    n = r["OBJECT_NAME"]
    return n.startswith("STARLINK") or n.startswith("TINTIN")


def is_kuiper(r):
    return r["OBJECT_NAME"].startswith("KUIPER")


def is_oneweb(r):
    return r["OBJECT_NAME"].startswith("ONEWEB")


def shell_starlink(inc, r):
    if inc > 90:
        return 560.0
    if inc > 60:
        return 570.0
    if inc < 40:
        return 525.0 if inc > 35 else 350.0
    if inc < 48:
        return 530.0
    return 550.0


def shell_kuiper(inc, r):
    # Protoflight (KUIPER-P1/P2) flew a low, 30° orbit, not the 630 km shell.
    if r["OBJECT_NAME"].startswith("KUIPER-P") or inc < 40:
        if r.get("APOGEE") and r.get("PERIGEE"):
            return (float(r["APOGEE"]) + float(r["PERIGEE"])) / 2.0
        return 280.0
    return 630.0


def shell_oneweb(inc, r):
    return 1200.0


CONSTELLATIONS = {
    "starlink": {
        "id": "starlink",
        "name": "Starlink",
        "out": "starlink.json",
        "min_sats": 5000,
        "select": is_starlink,
        "gp": [("GROUP", "starlink")],
        "insert_alt": 300,
        "raise": (40, 140),
        "shell": shell_starlink,
        "first_launch_label": "Tintin A/B prototypes",
        "fixed_pads": STARLINK_PAD_ORDER,
    },
    "amazon-leo": {
        "id": "amazon-leo",
        "name": "Amazon Leo",
        "out": "amazon-leo.json",
        "min_sats": 100,
        "select": is_kuiper,
        "gp": [("GROUP", "kuiper"), ("NAME", "KUIPER")],
        "insert_alt": 450,
        "raise": (40, 140),
        "shell": shell_kuiper,
        "first_launch_label": "KuiperSat-1 and KuiperSat-2 prototypes",
        "fixed_pads": None,
    },
    "oneweb": {
        "id": "oneweb",
        "name": "OneWeb",
        "out": "oneweb.json",
        "min_sats": 500,
        "select": is_oneweb,
        "gp": [("GROUP", "oneweb")],
        "insert_alt": 475,
        "raise": (60, 120),
        "shell": shell_oneweb,
        "first_launch_label": None,
        "fixed_pads": None,
    },
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "dkossin.com-escape-velocity/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("utf-8", "replace")


def parse_gcat_time(s):
    s = " ".join(s.replace("?", "").split())
    parts = s.split(" ")
    y, mon, d = parts[0], parts[1], parts[2]
    hhmm = parts[3] if len(parts) > 3 else "1200"
    sec = 0
    if ":" in hhmm:
        hhmm, sec = hhmm.split(":")
        sec = float(sec)
    hh, mm = int(hhmm[:2] or 12), int(hhmm[2:4] or 0)
    dt = datetime.strptime(f"{y} {mon} {d}", "%Y %b %d").replace(hour=hh, minute=mm, tzinfo=timezone.utc)
    return dt.timestamp() + sec


def ts_date(s):
    return datetime.strptime(s, "%Y-%m-%d").replace(hour=12, tzinfo=timezone.utc).timestamp()


def hash01(n, salt):
    x = (n * 2654435761 + salt * 40503) & 0xFFFFFFFF
    x ^= x >> 15
    x = (x * 2246822519) & 0xFFFFFFFF
    x ^= x >> 13
    return (x & 0xFFFFFF) / 0x1000000


def load_gcat(text):
    gcat = {}
    for line in text.splitlines():
        if line.startswith("#"):
            continue
        f = line.split("\t")
        if len(f) < 13:
            continue
        gcat[f[0].strip()] = (f[2].strip(), f[12].strip())
    return gcat


def resolve_pad_key(tag, satcat_site, gcat):
    if tag in gcat:
        key = gcat[tag][1]
        if key in PAD_INFO:
            return key
    if satcat_site in SATCAT_SITE_PAD:
        return SATCAT_SITE_PAD[satcat_site]
    return None


def build_one(cfg, satcat, gcat, gp_by_id):
    sats = [r for r in satcat if r["OBJECT_TYPE"] == "PAY" and cfg["select"](r)]
    if len(sats) < cfg["min_sats"]:
        print(f"SKIP {cfg['id']}: SATCAT returned only {len(sats)} payloads (min {cfg['min_sats']})", file=sys.stderr)
        return None

    epochs = []
    for nid, g in gp_by_id.items():
        # only count epochs for sats we'll use, if possible
        pass
    # reference instant: newest GP epoch among this constellation's in-orbit sats
    sat_ids = {int(r["NORAD_CAT_ID"]) for r in sats if not r["DECAY_DATE"]}
    for nid in sat_ids:
        g = gp_by_id.get(nid)
        if not g:
            continue
        epochs.append(datetime.fromisoformat(g["EPOCH"]).replace(tzinfo=timezone.utc).timestamp())
    if not epochs:
        print(f"SKIP {cfg['id']}: no GP epochs", file=sys.stderr)
        return None
    ref = max(epochs)

    groups = {}
    for r in sats:
        tag = r["OBJECT_ID"][:8]
        groups.setdefault(tag, []).append(r)

    # Determine pad keys used, then assign indices.
    if cfg["fixed_pads"]:
        pad_keys = list(cfg["fixed_pads"])
        key_to_idx = {k: i for i, k in enumerate(pad_keys)}
    else:
        used = []
        seen = set()
        # stable order: first appearance in launch-time order, preferring PAD_INFO order
        temp = []
        for tag, members in groups.items():
            key = resolve_pad_key(tag, members[0]["LAUNCH_SITE"], gcat)
            t = None
            if tag in gcat:
                try:
                    t = parse_gcat_time(gcat[tag][0])
                except Exception:
                    t = None
            if t is None:
                t = ts_date(members[0]["LAUNCH_DATE"])
            temp.append((t, key or "LC40"))
        temp.sort()
        for _, key in temp:
            if key not in seen:
                seen.add(key)
                used.append(key)
        # sort used by global PAD_INFO order for stable weekly diffs
        order = {k: i for i, k in enumerate(PAD_INFO)}
        pad_keys = sorted(used, key=lambda k: order.get(k, 999))
        key_to_idx = {k: i for i, k in enumerate(pad_keys)}

    launches = []
    for tag, members in groups.items():
        t = None
        key = resolve_pad_key(tag, members[0]["LAUNCH_SITE"], gcat)
        if cfg["fixed_pads"]:
            # Preserve historical Starlink mapping, including SATCAT fallbacks.
            pad = None
            if tag in gcat:
                pad = STARLINK_PAD_INDEX.get(gcat[tag][1])
            if pad is None:
                if members[0]["LAUNCH_SITE"] == "STARB":
                    pad = 3
                else:
                    pad = 2 if members[0]["LAUNCH_SITE"] == "AFWTR" else 0
            if tag in gcat:
                try:
                    t = parse_gcat_time(gcat[tag][0])
                except Exception:
                    t = None
        else:
            if key is None:
                print(f"warning: {cfg['id']} launch {tag} has unknown pad (site {members[0]['LAUNCH_SITE']}); defaulting", file=sys.stderr)
                key = pad_keys[0]
            pad = key_to_idx[key]
            if tag in gcat:
                try:
                    t = parse_gcat_time(gcat[tag][0])
                except Exception:
                    t = None
        if t is None:
            t = ts_date(members[0]["LAUNCH_DATE"])
        launches.append([tag, int(t), pad, len(members)])
    launches.sort(key=lambda x: x[1])
    lidx = {l[0]: i for i, l in enumerate(launches)}

    rec = []
    group_alts = {}
    for r in sats:
        nid = int(r["NORAD_CAT_ID"])
        g = gp_by_id.get(nid) if not r["DECAY_DATE"] else None
        if g:
            n = float(g["MEAN_MOTION"]) * 2 * math.pi / 86400.0
            a = (MU / n ** 2) ** (1 / 3)
            group_alts.setdefault(r["OBJECT_ID"][:8], []).append(a - RE)
        rec.append((r, g))

    cols = {k: [] for k in "LDIAOUGR"}
    raise0, raise_span = cfg["raise"]
    for r, g in sorted(rec, key=lambda x: (lidx[x[0]["OBJECT_ID"][:8]], x[0]["OBJECT_ID"])):
        nid = int(r["NORAD_CAT_ID"])
        tag = r["OBJECT_ID"][:8]
        tl = launches[lidx[tag]][1]
        decay = ts_date(r["DECAY_DATE"]) if r["DECAY_DATE"] else 0
        if g:
            inc = float(g["INCLINATION"])
            n_rev = float(g["MEAN_MOTION"])
            n = n_rev * 2 * math.pi / 86400.0
            a = (MU / n ** 2) ** (1 / 3)
            alt = a - RE
            ep = datetime.fromisoformat(g["EPOCH"]).replace(tzinfo=timezone.utc).timestamp()
            dt = ref - ep
            ci = math.cos(math.radians(inc))
            raan_dot = -1.5 * n * J2 * (RE / a) ** 2 * ci
            raan = (float(g["RA_OF_ASC_NODE"]) + math.degrees(raan_dot * dt)) % 360
            u = (float(g["ARG_OF_PERICENTER"]) + float(g["MEAN_ANOMALY"]) + math.degrees(n * dt)) % 360
            is_gp = 1
            age_days = (ep - tl) / 86400.0
        else:
            inc = float(r["INCLINATION"] or 53)
            ga = group_alts.get(tag)
            alt = statistics.median(ga) if ga else cfg["shell"](inc, r)
            if r["OBJECT_NAME"].startswith("TINTIN"):
                alt = 510.0
            if r["OBJECT_NAME"].startswith("KUIPER-P"):
                alt = cfg["shell"](inc, r)
            if decay and (decay - tl) < 120 * 86400:
                alt = float(cfg["insert_alt"])
            raan = hash01(nid, 1) * 360
            u = hash01(nid, 2) * 360
            is_gp = 0
            age_days = 1e9
        raise_days = raise0 + hash01(nid, 3) * raise_span
        if is_gp:
            raise_days = max(1.0, min(raise_days, age_days))
        if decay and (decay - tl) < 120 * 86400:
            raise_days = 1.0
        cols["L"].append(lidx[tag])
        cols["D"].append(int(decay))
        cols["I"].append(round(inc * 100))
        cols["A"].append(round(alt))
        cols["O"].append(round(raan * 100))
        cols["U"].append(round(u * 100))
        cols["G"].append(is_gp)
        cols["R"].append(round(raise_days))

    sites = []
    pad_names = []
    for key in pad_keys:
        info = PAD_INFO[key]
        pad_names.append(info["name"])
        sites.append({"lat": info["lat"], "lon": info["lon"], "az": info["az"]})

    out = {
        "id": cfg["id"],
        "name": cfg["name"],
        "asOf": datetime.fromtimestamp(ref, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ref": int(ref * 1000),
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "insertAlt": cfg["insert_alt"],
        "firstLaunchLabel": cfg["first_launch_label"],
        "pads": pad_names,
        "sites": sites,
        "launches": launches,
        **cols,
    }
    path = DATA / cfg["out"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, separators=(",", ":")))
    inorbit = sum(1 for d in cols["D"] if not d)
    print(f"{cfg['id']}: {len(cols['L'])} satellites, {len(launches)} launches, {inorbit} in orbit, as of {out['asOf']} -> {path}")
    return out


def fetch_gp(queries):
    by_id = {}
    for kind, value in queries:
        url = f"{GP_BASE}?{kind}={value}&FORMAT=json"
        raw = get(url)
        try:
            arr = json.loads(raw)
        except json.JSONDecodeError:
            print(f"warning: GP query {kind}={value} did not return JSON", file=sys.stderr)
            continue
        if not isinstance(arr, list):
            print(f"warning: GP query {kind}={value} unexpected payload", file=sys.stderr)
            continue
        for g in arr:
            by_id[int(g["NORAD_CAT_ID"])] = g
    return by_id


def main(only=None):
    names = only or list(CONSTELLATIONS)
    satcat = list(csv.DictReader(io.StringIO(get(SATCAT_URL))))
    gcat = load_gcat(get(GCAT_URL))
    # union of GP queries across selected constellations, then each build filters
    gp_all = {}
    for name in names:
        cfg = CONSTELLATIONS[name]
        gp_all.update(fetch_gp(cfg["gp"]))

    built = 0
    for name in names:
        cfg = CONSTELLATIONS[name]
        # pass only relevant GP; build_one also looks up by NORAD
        result = build_one(cfg, satcat, gcat, gp_all)
        if result:
            built += 1
    if built == 0:
        sys.exit("no constellation files were written")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("names", nargs="*", help="constellation ids (default: all)")
    args = p.parse_args()
    only = args.names or None
    if only:
        unknown = [n for n in only if n not in CONSTELLATIONS]
        if unknown:
            sys.exit(f"unknown constellation(s): {unknown}")
    main(only)
