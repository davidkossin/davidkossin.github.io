#!/usr/bin/env python3
"""Build escape-velocity/data/starlink.json for the Starlink Constellation view.

Sources
  - CelesTrak SATCAT (https://celestrak.org/pub/satcat.csv): every object named
    STARLINK-* (plus the two TINTIN prototypes), with launch date, decay date,
    international designator (grouped by launch), inclination, apogee, perigee.
  - CelesTrak GP elements, Starlink group
    (https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json):
    current mean elements for satellites still in orbit.
  - Jonathan McDowell's GCAT launch list
    (https://planet4589.org/space/gcat/tsv/launch/launch.tsv): launch time (UTC)
    and launch pad for each launch designator.

Output (compact, columnar):
  asOf       ISO time of the newest GP epoch (the reference instant)
  ref        reference instant, Unix ms; angles below are given at this instant
  launches   [[designator, unixSeconds, padCode, satCount], ...] sorted by time
  pads       pad code -> name
  L, D, I, A, O, U, G, R  per-satellite columns:
     L launch index, D decay (Unix seconds) or 0, I inclination*100 (deg),
     A operational altitude km, O RAAN at ref*100 (deg), U argument of
     latitude at ref*100 (deg), G 1 if elements are current GP data,
     R orbit-raising duration (days)

Approximations (documented here, not on the page):
  - Orbits are treated as circular (Starlink eccentricities are ~1e-4).
  - Satellites with no current elements (decayed) take inclination from
    SATCAT, altitude from the median of active satellites of the same launch
    (or a shell default by inclination), and a pseudo-random RAAN/phase.
  - Satellites that decayed within 120 days of launch are treated as never
    having raised their orbit (e.g. the Feb 2022 storm loss, the Jul 2024
    upper-stage anomaly).
"""
import csv
import io
import json
import math
import statistics
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SATCAT_URL = "https://celestrak.org/pub/satcat.csv"
GP_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json"
GCAT_URL = "https://planet4589.org/space/gcat/tsv/launch/launch.tsv"
OUT = Path(__file__).resolve().parent.parent / "data" / "starlink.json"

MU = 398600.4418
RE = 6378.137
J2 = 1.08262668e-3
PADS = {"LC40": 0, "LC39A": 1, "SLC4E": 2}
PAD_NAMES = ["Cape Canaveral SLC-40", "Kennedy LC-39A", "Vandenberg SLC-4E", "Starbase"]


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


def shell_default(inc):
    if inc > 90:
        return 560.0
    if inc > 60:
        return 570.0
    if inc < 40:
        return 525.0 if inc > 35 else 350.0
    if inc < 48:
        return 530.0
    return 550.0


def main():
    satcat = list(csv.DictReader(io.StringIO(get(SATCAT_URL))))
    gp = json.loads(get(GP_URL))
    gcat_lines = get(GCAT_URL).splitlines()

    gcat = {}
    for line in gcat_lines:
        if line.startswith("#"):
            continue
        f = line.split("\t")
        if len(f) < 13:
            continue
        gcat[f[0].strip()] = (f[2].strip(), f[12].strip())

    sats = [r for r in satcat
            if r["OBJECT_TYPE"] == "PAY"
            and (r["OBJECT_NAME"].startswith("STARLINK") or r["OBJECT_NAME"].startswith("TINTIN"))]
    if len(sats) < 5000:
        sys.exit(f"SATCAT returned only {len(sats)} Starlink payloads; refusing to overwrite")

    gp_by_id = {int(g["NORAD_CAT_ID"]): g for g in gp}
    epochs = [datetime.fromisoformat(g["EPOCH"]).replace(tzinfo=timezone.utc).timestamp() for g in gp]
    ref = max(epochs)

    # Launch groups
    groups = {}
    for r in sats:
        tag = r["OBJECT_ID"][:8]
        groups.setdefault(tag, []).append(r)
    launches = []
    for tag, members in groups.items():
        t = None
        pad = 3 if members[0]["LAUNCH_SITE"] == "STARB" else None
        if tag in gcat:
            try:
                t = parse_gcat_time(gcat[tag][0])
            except Exception:
                t = None
            pad = PADS.get(gcat[tag][1], pad)
        if t is None:
            t = ts_date(members[0]["LAUNCH_DATE"])
        if pad is None:
            pad = 2 if members[0]["LAUNCH_SITE"] == "AFWTR" else 0
        launches.append([tag, int(t), pad, len(members)])
    launches.sort(key=lambda x: x[1])
    lidx = {l[0]: i for i, l in enumerate(launches)}

    # Per-satellite elements
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
            raan_dot = -1.5 * n * J2 * (RE / a) ** 2 * ci  # rad/s
            raan = (float(g["RA_OF_ASC_NODE"]) + math.degrees(raan_dot * dt)) % 360
            u = (float(g["ARG_OF_PERICENTER"]) + float(g["MEAN_ANOMALY"]) + math.degrees(n * dt)) % 360
            is_gp = 1
            age_days = (ep - tl) / 86400.0
        else:
            inc = float(r["INCLINATION"] or 53)
            ga = group_alts.get(tag)
            alt = statistics.median(ga) if ga else shell_default(inc)
            if r["OBJECT_NAME"].startswith("TINTIN"):
                alt = 510.0
            if decay and (decay - tl) < 120 * 86400:
                alt = 300.0
            raan = hash01(nid, 1) * 360
            u = hash01(nid, 2) * 360
            is_gp = 0
            age_days = 1e9
        raise_days = 40 + hash01(nid, 3) * 140
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

    out = {
        "asOf": datetime.fromtimestamp(ref, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ref": int(ref * 1000),
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pads": PAD_NAMES,
        "launches": launches,
        **cols,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    inorbit = sum(1 for d in cols["D"] if not d)
    print(f"{len(cols['L'])} satellites, {len(launches)} launches, {inorbit} in orbit, as of {out['asOf']} -> {OUT}")


if __name__ == "__main__":
    main()
