#!/usr/bin/env python3
"""Build Escape Velocity Lagrange trajectory data from JPL Horizons and
analytic models for missions not in Horizons.

Earth-centered Sun–Earth rotating frame:
  +X  from the Sun through Earth
  +Z  along Earth's orbital angular momentum
  units: kilometres

Usage: python3 fetch_lagrange.py
Writes: ../data/lagrange-missions.json and ../data/lagrange-traj.json
"""
from __future__ import annotations

import json
import math
import os
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import sys as _sys
_sys.path.insert(0, str(Path(__file__).resolve().parent))
from lagrange_smooth import smooth_track  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CACHE = Path("/workspace/horizons-cache")
CACHE.mkdir(parents=True, exist_ok=True)

ASOF = date(2026, 11, 16)
AU = 149597870.7
# Earth+Moon / Sun+(Earth+Moon)
MU_SE = 3.0404235e-6
# Moon / (Earth+Moon)
MU_EM = 0.0121507855
# Mean Earth–Moon distance
A_MOON = 384400.0

HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
UA = "ObjectsInSpaceLagrange/1.0 (dkossin.com; research/educational)"

MON = {"JAN":1,"FEB":2,"MAR":3,"APR":4,"MAY":5,"JUN":6,"JUL":7,"AUG":8,"SEP":9,"OCT":10,"NOV":11,"DEC":12}

def parse_horizons_ad(msg, kind="prior"):
    """Return (date, 'HH:MM') from a Horizons coverage error, or None."""
    import re
    pat = r"%s(?: to)? A\.D\. ([0-9]{4})-([A-Z]{3})-([0-9]{2})(?:\s+(\d{2}):(\d{2}))?" % kind
    m = re.search(pat, msg, re.I)
    if not m:
        return None
    y, mon, d = int(m.group(1)), MON[m.group(2).upper()], int(m.group(3))
    hh = int(m.group(4) or 0)
    mm = int(m.group(5) or 0)
    return date(y, mon, d), f"{hh:02d}:{mm:02d}"



# Approximate CRTBP distances from the smaller primary (Earth or Moon).
def l1_l2_distance(a, mu):
    # Solve the fifth-degree equations iteratively; start from (μ/3)**(1/3)
    g = (mu / 3.0) ** (1.0 / 3.0)
    # L1 (between): Earth to L1
    x = g
    for _ in range(20):
        x = (mu * (1 - x) ** 2 / (3 - 2 * x - mu * (1 - x) ** 3 + (1 - mu) * x ** 3)) ** (1 / 3) if False else x
        # Standard iteration for γ1 from the quintic
        # (1-μ)/(1-γ)^2 - μ/γ^2 = 1 - μ + γ  ... use Newton on f(γ)=0
        # f = (1-μ)/(1-γ)**2 + μ/γ**2 - 1/γ**2 wait.
        # Position from barycenter: Earth at +μ1*a? Standard: Sun at -μ, Earth at 1-μ,
        # L1 at 1-μ-γ. Equation: (1-μ)/γ**2 - μ/(1-γ)**2 = 1-μ-γ  (signs).
        break
    # Newton on well-known forms
    def newton(f, df, x0):
        x = x0
        for _ in range(25):
            fx, dfx = f(x), df(x)
            if abs(dfx) < 1e-18:
                break
            x -= fx / dfx
        return abs(x)

    # γ_L1: distance from Earth toward the Sun, in units of a
    # f(γ) = (1-μ)/(1-γ)**2 - μ/γ**2 - (1-μ-γ) = 0  ? 
    # With origin at barycenter, positions: Sun = -μ, Earth = 1-μ, r_s = 1.
    # L1 at 1-μ-γ (γ>0). Equilibrium:
    # (1-μ)/ (1-γ)**2 - μ/γ**2 = 1-μ-γ
    def f1(g):
        return (1 - mu) / (1 - g) ** 2 - mu / g ** 2 - (1 - mu - g)
    def df1(g):
        return 2 * (1 - mu) / (1 - g) ** 3 + 2 * mu / g ** 3 + 1
    g1 = newton(f1, df1, (mu / 3.0) ** (1.0 / 3.0))
    # L2 at 1-μ+γ. Equilibrium:
    # (1-μ)/(1+γ)**2 + μ/γ**2 = 1-μ+γ
    def f2(g):
        return (1 - mu) / (1 + g) ** 2 + mu / g ** 2 - (1 - mu + g)
    def df2(g):
        return -2 * (1 - mu) / (1 + g) ** 3 - 2 * mu / g ** 3 - 1
    g2 = newton(f2, df2, (mu / 3.0) ** (1.0 / 3.0))
    return a * g1, a * g2

SE_L1_DIST, SE_L2_DIST = l1_l2_distance(AU, MU_SE)
EM_L1_DIST, EM_L2_DIST = l1_l2_distance(A_MOON, MU_EM)


def d2mjd(d: date) -> float:
    # MJD at 00:00 TT ≈ UTC for our purposes
    return d.toordinal() - date(1858, 11, 17).toordinal()


def mjd2date(mjd: float) -> date:
    whole = int(math.floor(mjd))
    return date(1858, 11, 17) + timedelta(days=whole)


def mjd2iso(mjd: float) -> str:
    whole = int(math.floor(mjd))
    frac = mjd - whole
    d = date(1858, 11, 17) + timedelta(days=whole)
    seconds = int(round(frac * 86400))
    if seconds == 86400:
        d += timedelta(days=1)
        seconds = 0
    h, rem = divmod(seconds, 3600)
    mi, s = divmod(rem, 60)
    if h == 0 and mi == 0 and s == 0:
        return d.isoformat()
    return f"{d.isoformat()}T{h:02d}:{mi:02d}:{s:02d}Z"


def iso2date(s: str) -> date:
    return date.fromisoformat(s[:10])


def parse_horizons(text: str):
    if "$$SOE" not in text or "$$EOE" not in text:
        err = ""
        for line in text.splitlines():
            if "ERROR" in line or "No ephemeris" in line or "Cannot" in line or "Unknown" in line:
                err += line.strip() + " | "
        raise RuntimeError(err or "no SOE/EOE in Horizons response")
    body = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    rows = []
    for line in body.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 5:
            continue
        try:
            jd = float(parts[0])
            x, y, z = float(parts[2]), float(parts[3]), float(parts[4])
        except (ValueError, IndexError):
            continue
        vx = vy = vz = 0.0
        if len(parts) >= 8 and parts[5] and parts[6] and parts[7]:
            try:
                vx, vy, vz = float(parts[5]), float(parts[6]), float(parts[7])
            except ValueError:
                pass
        mjd = jd - 2400000.5
        rows.append((mjd, x, y, z, vx, vy, vz))
    return rows


LAST_CACHED = False


def horizons_request(command, start, stop, step, retries=4):
    key = f"{command}_{start}_{stop}_{step}".replace(" ", "_").replace("/", "-").replace(":", "")
    cache = CACHE / f"{key}.txt"
    global LAST_CACHED
    LAST_CACHED = False
    if cache.exists() and cache.stat().st_size > 200:
        LAST_CACHED = True
        return cache.read_text(errors="replace")
    params = {
        "format": "text",
        "COMMAND": f"'{command}'",
        "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "VECTORS",
        "CENTER": "'@0'",
        "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": f"'{step}'",
        "VEC_TABLE": "2",
        "REF_PLANE": "ECLIPTIC",
        "REF_SYSTEM": "ICRF",
        "OUT_UNITS": "KM-S",
        "CSV_FORMAT": "YES",
        "VEC_LABELS": "NO",
        "EMAIL_ADDR": "dkossin.com",
    }
    url = HORIZONS + "?" + urllib.parse.urlencode(params)
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as resp:
                text = resp.read().decode("utf-8", "replace")
            if "$$SOE" in text or "No ephemeris for target" in text:
                # Coverage errors are cached too, so reruns do not re-ask.
                cache.write_text(text)
                return text
            last = RuntimeError("Horizons error for %s: %s" % (command, text[0:400].replace("\n", " ")))
        except Exception as e:
            last = e
        time.sleep(1.0 * (i + 1))
    raise last


def chunk_range(start: date, stop: date, years=4):
    t = start
    while t < stop:
        nxt = date(t.year + years, t.month, t.day) if t.month != 2 or t.day != 29 else date(t.year + years, 2, 28)
        if nxt > stop:
            nxt = stop
        if nxt <= t:
            nxt = stop
        yield t, nxt
        t = nxt
        if t < stop:
            t = t  # inclusive overlap handled by unique MJD later


def fetch_series(command, start: date, stop: date, step="1 d", start_clock="12:00", stop_clock=None, _depth=0):
    """Fetch SSB vectors, clipping to Horizons coverage if the first request is rejected."""
    if _depth > 4:
        raise RuntimeError(f"too many coverage retries for {command}")
    if stop <= start:
        stop = start + timedelta(days=1)
    rows = []
    seen = set()

    def add(part):
        for r in part:
            k = round(r[0], 6)
            if k not in seen:
                seen.add(k)
                rows.append(r)

    chunks = list(chunk_range(start, stop, 4))
    for i, (a, b) in enumerate(chunks):
        if b <= a:
            continue
        if (b - a).days < 1:
            b = a + timedelta(days=1)
        a_str = a.isoformat() + ((" " + start_clock) if (i == 0 and start_clock) else "")
        b_str = b.isoformat() + ((" " + stop_clock) if (i == len(chunks) - 1 and stop_clock) else "")
        print(f"  Horizons {command} {a_str} → {b_str} ({step}) [{i+1}/{len(chunks)}]", flush=True)
        try:
            text = horizons_request(command, a_str, b_str, step)
            add(parse_horizons(text))
        except Exception as e:
            msg = str(e)
            prior = parse_horizons_ad(msg, "prior")
            after = parse_horizons_ad(msg, "after")
            if prior:
                pd, clock = prior
                # Move at least a few minutes past the first available sample.
                hh, mm = [int(x) for x in clock.split(":")]
                mm += 5
                if mm >= 60:
                    hh += 1
                    mm -= 60
                if hh >= 24:
                    pd = pd + timedelta(days=1)
                    hh, mm = 0, 5
                clock = f"{hh:02d}:{mm:02d}"
                if pd > stop or (pd == stop and not stop_clock):
                    raise RuntimeError(f"no overlap with Horizons coverage for {command} (starts {pd})")
                print(f"    coverage starts {pd.isoformat()} {clock}, restarting", flush=True)
                return fetch_series(command, pd, stop, step, start_clock=clock, stop_clock=stop_clock, _depth=_depth + 1)
            if after:
                ad, clock = after
                # Clip the stop to just before the last available sample.
                hh, mm = [int(x) for x in clock.split(":")]
                if mm < 5:
                    if hh == 0:
                        ad = ad - timedelta(days=1)
                        hh, mm = 23, 55
                    else:
                        hh, mm = hh - 1, mm + 55
                else:
                    mm -= 5
                clock = f"{hh:02d}:{mm:02d}"
                if ad < start:
                    raise RuntimeError(f"no overlap with Horizons coverage for {command} (ends {ad})")
                print(f"    coverage ends {ad.isoformat()} {clock}, clipping stop", flush=True)
                return fetch_series(command, start, ad, step, start_clock=start_clock, stop_clock=clock, _depth=_depth + 1)
            raise
        if not LAST_CACHED:
            time.sleep(0.35)
    rows.sort(key=lambda r: r[0])
    return rows



def interp(series, mjd):
    """Linear interpolate (x,y,z[,vx,vy,vz]) at mjd. series sorted by mjd."""
    if not series:
        return None
    if mjd <= series[0][0]:
        r = series[0]
        return r[1:]
    if mjd >= series[-1][0]:
        r = series[-1]
        return r[1:]
    lo, hi = 0, len(series) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if series[mid][0] <= mjd:
            lo = mid
        else:
            hi = mid
    a, b = series[lo], series[hi]
    if b[0] == a[0]:
        return a[1:]
    t = (mjd - a[0]) / (b[0] - a[0])
    if len(a) >= 7 and len(b) >= 7 and (any(a[4:7]) or any(b[4:7])):
        # Cubic Hermite with Horizons velocities (km/s). Linear interpolation of
        # Earth/Sun at 12 h cadence is off by up to ~1,400 km mid-interval, which
        # puts a 12-hour zigzag into every densely sampled Earth-centred path.
        h = (b[0] - a[0]) * 86400.0
        t2, t3 = t * t, t * t * t
        h00, h10, h01, h11 = 2 * t3 - 3 * t2 + 1, t3 - 2 * t2 + t, -2 * t3 + 3 * t2, t3 - t2
        d00, d10, d01, d11 = 6 * t2 - 6 * t, 3 * t2 - 4 * t + 1, -6 * t2 + 6 * t, 3 * t2 - 2 * t
        pos = tuple(h00 * a[i] + h10 * h * a[i + 3] + h01 * b[i] + h11 * h * b[i + 3] for i in (1, 2, 3))
        vel = tuple((d00 * a[i] + d10 * h * a[i + 3] + d01 * b[i] + d11 * h * b[i + 3]) / h for i in (1, 2, 3))
        return pos + vel + tuple(a[i] + t * (b[i] - a[i]) for i in range(7, len(a)))
    return tuple(a[i] + t * (b[i] - a[i]) for i in range(1, len(a)))


def rot_frame(earth, sun):
    # earth, sun are (x,y,z,vx,vy,vz) in SSB ecliptic km, km/s
    rex, rey, rez = earth[0] - sun[0], earth[1] - sun[1], earth[2] - sun[2]
    vex, vey, vez = earth[3] - sun[3], earth[4] - sun[4], earth[5] - sun[5]
    rn = math.sqrt(rex * rex + rey * rey + rez * rez) or 1.0
    xh = (rex / rn, rey / rn, rez / rn)
    zx = rey * vez - rez * vey
    zy = rez * vex - rex * vez
    zz = rex * vey - rey * vex
    zn = math.sqrt(zx * zx + zy * zy + zz * zz) or 1.0
    zh = (zx / zn, zy / zn, zz / zn)
    yh = (zh[1] * xh[2] - zh[2] * xh[1], zh[2] * xh[0] - zh[0] * xh[2], zh[0] * xh[1] - zh[1] * xh[0])
    return xh, yh, zh, rn


def to_rot(pos, earth, sun):
    xh, yh, zh, rn = rot_frame(earth, sun)
    rx, ry, rz = pos[0] - earth[0], pos[1] - earth[1], pos[2] - earth[2]
    return (rx * xh[0] + ry * xh[1] + rz * xh[2],
            rx * yh[0] + ry * yh[1] + rz * yh[2],
            rx * zh[0] + ry * zh[1] + rz * zh[2],
            rn)


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------------------
# Mission catalog (26 occupying payloads)
# appear_start/end bound the visible trajectory (L-point related portion)
# ---------------------------------------------------------------------------

MISSIONS = [
    {
        "id": "isee3",
        "name": "ISEE-3 (ICE)",
        "agency": "NASA",
        "cospar": "1978-079A",
        "horizons": -111,
        "launch": "1978-08-12",
        "launch_time": "15:12 UTC",
        "appear_start": "1978-08-12",
        "appear_end": "1983-04-01",
        "stays": [
            {"point": "SE-L1", "arrival": "1978-11-20", "departure": "1982-06-10"},
        ],
        "status": "heliocentric disposal",
        "url": "https://science.nasa.gov/mission/isee-3/",
        "summary": "Launched in 1978, ISEE-3 was the first spacecraft to orbit a Lagrange point, circling Sun–Earth L1 in a halo orbit. In 1982 it left L1 and was later retargeted, as ICE, to fly past comets Giacobini–Zinner and Halley. It remains in a heliocentric orbit.",
    },
    {
        "id": "wind",
        "name": "WIND",
        "agency": "NASA",
        "cospar": "1994-071A",
        "horizons": -8,
        "launch": "1994-11-01",
        "launch_time": "09:31 UTC",
        "appear_start": "1994-11-01",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L1", "arrival": "1995-02-03", "departure": "2003-11-07"},
            {"point": "SE-L2", "arrival": "2003-11-07", "departure": "2004-02-03"},
            {"point": "SE-L1", "arrival": "2004-06-02", "departure": None},
        ],
        "status": "active",
        "url": "https://wind.nasa.gov/",
        "summary": "NASA’s WIND observatory studies the solar wind. After a long series of petal orbits and a stay at Sun–Earth L2 in 2003–2004, it has operated at Sun–Earth L1 since June 2004.",
    },
    {
        "id": "soho",
        "name": "SOHO",
        "agency": "ESA / NASA",
        "cospar": "1995-065A",
        "horizons": -21,
        "launch": "1995-12-02",
        "launch_time": "08:08 UTC",
        "appear_start": "1995-12-02",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L1", "arrival": "1995-12-23", "departure": None},
        ],
        "status": "active",
        "url": "https://soho.nascom.nasa.gov/",
        "summary": "The Solar and Heliospheric Observatory has watched the Sun from a halo orbit about Sun–Earth L1 since December 1995, a joint mission of ESA and NASA.",
    },
    {
        "id": "ace",
        "name": "ACE",
        "agency": "NASA",
        "cospar": "1997-045A",
        "horizons": -92,
        "launch": "1997-08-25",
        "launch_time": "14:39 UTC",
        "appear_start": "1997-08-25",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L1", "arrival": "1997-09-16", "departure": None},
        ],
        "status": "active",
        "url": "https://izw1.caltech.edu/ACE/",
        "summary": "The Advanced Composition Explorer measures the solar wind and energetic particles from a Lissajous orbit about Sun–Earth L1, where it has remained since 1997.",
    },
    {
        "id": "wmap",
        "name": "WMAP",
        "agency": "NASA",
        "cospar": "2001-027A",
        "horizons": -165,
        "launch": "2001-06-30",
        "launch_time": "19:46 UTC",
        "appear_start": "2001-06-30",
        "appear_end": "2010-12-15",
        "stays": [
            {"point": "SE-L2", "arrival": "2001-08-26", "departure": "2010-10-20"},
        ],
        "status": "heliocentric disposal",
        "url": "https://map.gsfc.nasa.gov/",
        "summary": "The Wilkinson Microwave Anisotropy Probe mapped the cosmic microwave background from Sun–Earth L2 between 2001 and 2010, then was placed in a heliocentric orbit away from the Earth–Moon system.",
    },
    {
        "id": "genesis",
        "name": "Genesis",
        "agency": "NASA",
        "cospar": "2001-034A",
        "horizons": -47,
        "launch": "2001-08-08",
        "launch_time": "16:13 UTC",
        "appear_start": "2001-08-08",
        "appear_end": "2005-04-01",
        "stays": [
            {"point": "SE-L1", "arrival": "2001-08-29", "departure": "2004-03-26"},
            {"point": "SE-L2", "arrival": "2004-06-14", "departure": "2004-08-15"},
            {"point": "SE-L1", "arrival": "2004-12-05", "departure": "2005-02-27"},
        ],
        "status": "heliocentric disposal",
        "url": "https://science.nasa.gov/mission/genesis/",
        "summary": "Genesis collected samples of the solar wind at Sun–Earth L1. After a brief visit to L2 and a return to L1, its sample capsule landed on Earth in September 2004; the spacecraft itself was left in a heliocentric orbit.",
    },
    {
        "id": "artemis-p1",
        "name": "ARTEMIS P1",
        "agency": "NASA",
        "cospar": "2007-004B",
        "horizons": -192,
        "launch": "2007-02-17",
        "launch_time": "23:01 UTC",
        "appear_start": "2010-01-15",
        "appear_end": "2011-07-15",
        "stays": [
            {"point": "SE-L1", "arrival": "2010-02-14", "departure": "2010-05-04"},
            {"point": "EM-L2", "arrival": "2010-08-30", "departure": "2010-12-30"},
            {"point": "EM-L1", "arrival": "2011-01-11", "departure": "2011-06-24"},
        ],
        "status": "retired-departed",
        "url": "https://science.nasa.gov/mission/themis/",
        "summary": "Launched in 2007 as THEMIS B, ARTEMIS P1 was the first spacecraft to occupy Earth–Moon L2, after a staging orbit at Sun–Earth L1. It later moved to Earth–Moon L1 and then into lunar orbit, where it remains a lunar orbiter.",
    },
    {
        "id": "artemis-p2",
        "name": "ARTEMIS P2",
        "agency": "NASA",
        "cospar": "2007-004C",
        "horizons": -193,
        "launch": "2007-02-17",
        "launch_time": "23:01 UTC",
        "appear_start": "2010-02-01",
        "appear_end": "2011-08-01",
        "stays": [
            {"point": "SE-L2", "arrival": "2010-03-29", "departure": "2010-06-17"},
            {"point": "EM-L1", "arrival": "2010-10-10", "departure": "2011-07-15"},
        ],
        "status": "retired-departed",
        "url": "https://science.nasa.gov/mission/themis/",
        "summary": "Launched in 2007 as THEMIS C, ARTEMIS P2 staged at Sun–Earth L2 in 2010, then occupied Earth–Moon L1 with its companion P1 — the first pair of spacecraft at the Earth–Moon Lagrange points. It is now a lunar orbiter.",
    },
    {
        "id": "herschel",
        "name": "Herschel",
        "agency": "ESA",
        "cospar": "2009-026A",
        "horizons": -486,
        "launch": "2009-05-14",
        "launch_time": "13:12 UTC",
        "appear_start": "2009-05-14",
        "appear_end": "2013-05-15",
        "stays": [
            {"point": "SE-L2", "arrival": "2009-06-05", "departure": "2013-03-19"},
        ],
        "status": "heliocentric disposal",
        "url": "https://www.esa.int/Science_Exploration/Space_Science/Herschel",
        "summary": "ESA’s Herschel Space Observatory observed the infrared universe from a halo orbit about Sun–Earth L2. After its helium coolant was exhausted in 2013, it was placed in a heliocentric parking orbit.",
    },
    {
        "id": "planck",
        "name": "Planck",
        "agency": "ESA",
        "cospar": "2009-026B",
        "horizons": -489,
        "launch": "2009-05-14",
        "launch_time": "13:12 UTC",
        "appear_start": "2009-05-14",
        "appear_end": "2013-10-31",
        "stays": [
            {"point": "SE-L2", "arrival": "2009-06-09", "departure": "2013-08-24"},
        ],
        "status": "heliocentric disposal",
        "url": "https://www.esa.int/Science_Exploration/Space_Science/Planck",
        "summary": "Planck, launched with Herschel, mapped the cosmic microwave background from Sun–Earth L2. The spacecraft was commanded into a heliocentric orbit in 2013 at the end of the mission.",
    },
    {
        "id": "change2",
        "name": "Chang'e 2",
        "agency": "CNSA",
        "cospar": "2010-050A",
        "horizons": None,
        "launch": "2010-10-01",
        "launch_time": "10:59 UTC",
        "appear_start": "2011-06-08",
        "appear_end": "2012-07-15",
        "stays": [
            {"point": "SE-L2", "arrival": "2011-08-25", "departure": "2012-05-30"},
        ],
        "status": "heliocentric disposal",
        "url": "https://www.cnsa.gov.cn/english/",
        "summary": "After completing its lunar survey, Chang'e 2 traveled to a halo orbit about Sun–Earth L2, arriving in August 2011. It left L2 on 30 May 2012 for a flyby of asteroid 4179 Toutatis and remains in a heliocentric orbit. Its path here is modeled; no public Horizons ephemeris was available.",
        "approximate": True,
    },
    {
        "id": "gaia",
        "name": "Gaia",
        "agency": "ESA",
        "cospar": "2013-074A",
        "horizons": -139479,
        "launch": "2013-12-19",
        "launch_time": "09:12 UTC",
        "appear_start": "2013-12-19",
        "appear_end": "2025-05-15",
        "stays": [
            {"point": "SE-L2", "arrival": "2014-01-13", "departure": "2025-02-08"},
        ],
        "status": "heliocentric disposal",
        "url": "https://www.esa.int/Science_Exploration/Space_Science/Gaia",
        "summary": "Gaia charted nearly two billion stars from a Lissajous orbit about Sun–Earth L2 from 2014 until early 2025, when it was moved into a stable heliocentric retirement orbit away from Earth.",
    },
    {
        "id": "ce5t1",
        "name": "Chang'e 5-T1",
        "agency": "CNSA",
        "cospar": "2014-065A",
        "horizons": None,
        "launch": "2014-10-23",
        "launch_time": "18:00 UTC",
        "appear_start": "2014-11-01",
        "appear_end": "2015-02-15",
        "stays": [
            {"point": "EM-L2", "arrival": "2014-11-27", "departure": "2015-01-05"},
        ],
        "status": "retired-departed",
        "url": "https://www.cnsa.gov.cn/english/",
        "summary": "The Chang'e 5-T1 service module, after a lunar flyby test of the sample-return capsule, entered an orbit about Earth–Moon L2 in late 2014 and left the point in January 2015. Its path here is modeled; no public Horizons ephemeris was available.",
        "approximate": True,
    },
    {
        "id": "dscovr",
        "name": "DSCOVR",
        "agency": "NOAA / NASA",
        "cospar": "2015-007A",
        "horizons": -78,
        "launch": "2015-02-11",
        "launch_time": "23:03 UTC",
        "appear_start": "2015-02-11",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L1", "arrival": "2015-06-08", "departure": None},
        ],
        "status": "active",
        "url": "https://www.nesdis.noaa.gov/current-satellite-missions/currently-flying/dscovr-deep-space-climate-observatory",
        "summary": "The Deep Space Climate Observatory, a NOAA and NASA mission, monitors the solar wind and images the sunlit Earth from a Lissajous orbit about Sun–Earth L1, which it entered in June 2015.",
    },
    {
        "id": "lpf",
        "name": "LISA Pathfinder",
        "agency": "ESA / NASA",
        "cospar": "2015-070A",
        "horizons": -141043,
        "launch": "2015-12-03",
        "launch_time": "04:04 UTC",
        "appear_start": "2015-12-03",
        "appear_end": "2017-08-15",
        "stays": [
            {"point": "SE-L1", "arrival": "2016-01-22", "departure": "2017-06-30"},
        ],
        "status": "heliocentric disposal",
        "url": "https://www.esa.int/Science_Exploration/Space_Science/LISA_Pathfinder",
        "summary": "LISA Pathfinder demonstrated the free-fall and measurement technology needed for a future gravitational-wave observatory, from a halo orbit about Sun–Earth L1, before being sent into a heliocentric orbit in 2017.",
    },
    {
        "id": "queqiao",
        "name": "Queqiao",
        "agency": "CNSA",
        "cospar": "2018-045A",
        "horizons": None,
        "launch": "2018-05-20",
        "launch_time": "21:28 UTC",
        "appear_start": "2018-05-20",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "EM-L2", "arrival": "2018-06-14", "departure": None},
        ],
        "status": "active",
        "url": "https://www.cnsa.gov.cn/english/",
        "summary": "Queqiao is a communications relay in a halo orbit about Earth–Moon L2, supporting the Chang'e 4 lander and rover on the lunar far side. It has remained at that point since June 2018. Its path here is modeled; no public Horizons ephemeris was available.",
        "approximate": True,
    },
    {
        "id": "spektrrg",
        "name": "Spektr-RG",
        "agency": "Roscosmos / DLR",
        "cospar": "2019-040A",
        "horizons": None,
        "launch": "2019-07-13",
        "launch_time": "12:30 UTC",
        "appear_start": "2019-07-13",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L2", "arrival": "2019-10-21", "departure": None},
        ],
        "status": "active",
        "url": "https://www.dlr.de/en/research-and-transfer/projects-and-missions/erosita",
        "summary": "Spektr-RG is a Russian–German X-ray observatory in a halo orbit about Sun–Earth L2, which it reached in October 2019. The eROSITA instrument was switched off in 2022; the spacecraft and the ART-XC instrument remain at L2. Its path here is modeled; no public Horizons ephemeris was available.",
        "approximate": True,
    },
    {
        "id": "change5",
        "name": "Chang'e 5 orbiter",
        "agency": "CNSA",
        "cospar": "2020-087A",
        "horizons": None,
        "launch": "2020-11-23",
        "launch_time": "20:30 UTC",
        "appear_start": "2021-02-01",
        "appear_end": "2021-10-01",
        "stays": [
            {"point": "SE-L1", "arrival": "2021-03-15", "departure": "2021-08-17"},
        ],
        "status": "retired-departed",
        "url": "https://www.cnsa.gov.cn/english/",
        "summary": "After sending its sample capsule back to Earth, the Chang'e 5 orbiter entered a halo orbit about Sun–Earth L1 in March 2021 and later left that point for further cislunar operations. Its path here is modeled; no public Horizons ephemeris was available.",
        "approximate": True,
    },
    {
        "id": "jwst",
        "name": "James Webb Space Telescope",
        "agency": "NASA / ESA / CSA",
        "cospar": "2021-130A",
        "horizons": -170,
        "launch": "2021-12-25",
        "launch_time": "12:20 UTC",
        "appear_start": "2021-12-25",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L2", "arrival": "2022-01-24", "departure": None},
        ],
        "status": "active",
        "url": "https://webb.nasa.gov/",
        "summary": "The James Webb Space Telescope observes the infrared universe from a halo orbit about Sun–Earth L2, which it entered on 24 January 2022. The halo’s amplitude is about 800,000 kilometres.",
    },
    {
        "id": "euclid",
        "name": "Euclid",
        "agency": "ESA / NASA",
        "cospar": "2023-092A",
        "horizons": -680,
        "launch": "2023-07-01",
        "launch_time": "15:12 UTC",
        "appear_start": "2023-07-01",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L2", "arrival": "2023-07-28", "departure": None},
        ],
        "status": "active",
        "url": "https://www.esa.int/Science_Exploration/Space_Science/Euclid",
        "summary": "Euclid is mapping the large-scale structure of the Universe from a halo orbit about Sun–Earth L2, which it reached in July 2023, in order to study dark matter and dark energy.",
    },
    {
        "id": "aditya",
        "name": "Aditya-L1",
        "agency": "ISRO",
        "cospar": "2023-132A",
        "horizons": -156,
        "launch": "2023-09-02",
        "launch_time": "06:20 UTC",
        "appear_start": "2023-09-02",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L1", "arrival": "2024-01-06", "departure": None},
        ],
        "status": "active",
        "url": "https://www.isro.gov.in/Aditya_L1.html",
        "summary": "Aditya-L1 is India’s first dedicated solar observatory. It entered a halo orbit about Sun–Earth L1 on 6 January 2024 and studies the Sun’s atmosphere and the solar wind.",
    },
    {
        "id": "change6",
        "name": "Chang'e 6 orbiter",
        "agency": "CNSA",
        "cospar": "2024-083A",
        "horizons": None,
        "launch": "2024-05-03",
        "launch_time": "09:27 UTC",
        "appear_start": "2024-07-01",
        "appear_end": "2025-08-15",
        "stays": [
            {"point": "SE-L2", "arrival": "2024-09-09", "departure": "2025-06-30"},
        ],
        "status": "retired-departed",
        "url": "https://www.cnsa.gov.cn/english/",
        "summary": "After the Chang'e 6 sample-return from the lunar far side, the orbiter was sent to a halo orbit about Sun–Earth L2, arriving in September 2024, and later left that point. The departure date is approximate, and the path is modeled; no public Horizons ephemeris was available.",
        "approximate": True,
    },
    {
        "id": "imap",
        "name": "IMAP",
        "agency": "NASA",
        "cospar": "2025-215A",
        "horizons": -43,
        "launch": "2025-09-24",
        "launch_time": "11:30 UTC",
        "appear_start": "2025-09-24",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L1", "arrival": "2026-01-10", "departure": None},
        ],
        "status": "active",
        "url": "https://science.nasa.gov/mission/imap/",
        "summary": "The Interstellar Mapping and Acceleration Probe studies the boundary of the heliosphere from a halo orbit about Sun–Earth L1, which it reached in January 2026 after launch on 24 September 2025.",
    },
    {
        "id": "swfo",
        "name": "SOLAR-1 (SWFO-L1)",
        "agency": "NOAA / NASA",
        "cospar": "2025-215B",
        "horizons": -231,
        "launch": "2025-09-24",
        "launch_time": "11:30 UTC",
        "appear_start": "2025-09-24",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L1", "arrival": "2026-01-23", "departure": None},
        ],
        "status": "active",
        "url": "https://www.nesdis.noaa.gov/swfo",
        "summary": "NOAA’s Space Weather Follow On spacecraft, launched with IMAP and later renamed SOLAR-1, monitors the solar wind from Sun–Earth L1 to support space-weather forecasts. It arrived at L1 on 23 January 2026.",
    },
    {
        "id": "carruthers",
        "name": "Carruthers Geocorona Observatory",
        "agency": "NASA",
        "cospar": "2025-215C",
        "horizons": -171,
        "launch": "2025-09-24",
        "launch_time": "11:30 UTC",
        "appear_start": "2025-09-24",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L1", "arrival": "2026-01-08", "departure": None},
        ],
        "status": "active",
        "url": "https://science.nasa.gov/mission/carruthers-geocorona-observatory/",
        "summary": "The Carruthers Geocorona Observatory, named for physicist Dr. George Carruthers, images Earth’s extended ultraviolet atmosphere from Sun–Earth L1. It launched with IMAP on 24 September 2025 and arrived in January 2026.",
    },
    {
        "id": "roman",
        "name": "Nancy Grace Roman Space Telescope",
        "agency": "NASA",
        "cospar": "2026-199A",
        "horizons": -211,
        "launch": "2026-08-30",
        "launch_time": "11:25 UTC",
        "appear_start": "2026-08-30",
        "appear_end": "2026-11-16",
        "stays": [
            {"point": "SE-L2", "arrival": "2026-09-18", "departure": None},
        ],
        "status": "active",
        "url": "https://roman.gsfc.nasa.gov/",
        "summary": "The Nancy Grace Roman Space Telescope launched on 30 August 2026 and entered a halo orbit about Sun–Earth L2 around 18 September 2026. It is designed for wide-field infrared surveys of dark energy, exoplanets, and the nearby universe.",
    },
]

# Halo templates used when Horizons is unavailable (km, days).
# Filled/updated from Horizons siblings after those are fetched.
HALO_TEMPLATES = {
    "SE-L1": {"Ax": 180000, "Ay": 520000, "Az": 220000, "period": 178.0, "south": True},
    "SE-L2": {"Ax": 280000, "Ay": 750000, "Az": 420000, "period": 180.0, "south": True},
    "EM-L1": {"Ax": 18000, "Ay": 35000, "Az": 20000, "period": 14.0, "south": False},
    "EM-L2": {"Ax": 20000, "Ay": 40000, "Az": 25000, "period": 14.5, "south": True},
}
# Mission-specific amplitude overrides (literature / sibling missions)
HALO_OVERRIDE = {
    "spektrrg": {"Ax": 260000, "Ay": 720000, "Az": 400000, "period": 176.0, "south": True},
    "change2": {"Ax": 200000, "Ay": 500000, "Az": 280000, "period": 180.0, "south": True},
    "change5": {"Ax": 150000, "Ay": 400000, "Az": 180000, "period": 178.0, "south": True},
    "change6": {"Ax": 220000, "Ay": 550000, "Az": 300000, "period": 180.0, "south": True},
    "queqiao": {"Ax": 18000, "Ay": 38000, "Az": 30000, "period": 14.5, "south": True},
    "ce5t1": {"Ax": 16000, "Ay": 32000, "Az": 20000, "period": 14.0, "south": True},
}


def point_pos(point, moon_xyzn, r_se=AU):
    """Theoretical L-point in the rotating frame (Earth origin). moon_xyzn = (x,y,z) or None."""
    se_l1, se_l2 = l1_l2_distance(r_se, MU_SE)
    if point == "SE-L1":
        return (-se_l1, 0.0, 0.0)
    if point == "SE-L2":
        return (se_l2, 0.0, 0.0)
    if point == "SE-L3":
        return (-r_se * (2 - (7 / 4) * MU_SE * 2), 0.0, 0.0)  # approx 2 AU toward the Sun from Earth... 
        # L3 is on the opposite side of the Sun from Earth, ~ -2*AU from Earth along X? 
        # Earth at 0, Sun at -r_se, L3 is slightly beyond -r_se, i.e. x ≈ -r_se - r_se = -2 r_se, plus a small offset.
        # More accurately L3 is almost opposite the Sun, x ≈ -r_se * (1 + 5/12 μ) from barycenter, from Earth: -(r_se + distance Sun-L3 wait)
        # Sun at -r_se, L3 is on the far side of the Sun, at about -(r_se + r_se) = -2 r_se from Earth, slightly closer to the Sun than a full AU beyond.
        # From Earth: x = -r_se - (r_se * (1 - 7/12 μ roughly)) ≈ -2 r_se
    if moon_xyzn is None:
        return (0.0, 0.0, 0.0)
    mx, my, mz = moon_xyzn
    # Unit vector Earth → Moon
    mn = math.sqrt(mx * mx + my * my + mz * mz) or 1.0
    ux, uy, uz = mx / mn, my / mn, mz / mn
    em_l1, em_l2 = l1_l2_distance(mn, MU_EM)
    if point == "EM-L1":
        # Between Earth and Moon: from Moon toward Earth by em_l1
        return (mx - ux * em_l1, my - uy * em_l1, mz - uz * em_l1)
    if point == "EM-L2":
        return (mx + ux * em_l2, my + uy * em_l2, mz + uz * em_l2)
    return (0.0, 0.0, 0.0)


# Fix SE-L3 in a later helper
def se_l345(r_se):
    # L3: slightly beyond the Sun, opposite Earth. From Earth: x ≈ -r_se - r_se*(1+(5/12)μ) ≈ -2 r_se
    l3x = -r_se * (2.0 - (7.0 / 12.0) * MU_SE)  # close enough
    # L4/L5: equilateral with Sun and Earth, 60° ahead/behind in the orbital plane
    # Sun at (-r_se, 0, 0), Earth at (0,0,0). Equilateral points:
    # at 60° from the Earth-Sun line: x = -r_se/2, y = ± r_se * sqrt(3)/2
    l4 = (-r_se * 0.5, r_se * math.sqrt(3) / 2, 0.0)
    l5 = (-r_se * 0.5, -r_se * math.sqrt(3) / 2, 0.0)
    return (l3x, 0.0, 0.0), l4, l5


def em_basis(moon):
    """Orthonormal Earth–Moon frame: +X toward the Moon, +Z near the ecliptic pole."""
    mx, my, mz = moon
    n = math.sqrt(mx * mx + my * my + mz * mz) or 1.0
    xh = (mx / n, my / n, mz / n)
    yh = (-xh[1], xh[0], 0.0)  # z-hat_SE × xh, then normalize
    yn = math.sqrt(yh[0] * yh[0] + yh[1] * yh[1] + yh[2] * yh[2]) or 1.0
    yh = (yh[0] / yn, yh[1] / yn, yh[2] / yn)
    zh = (xh[1] * yh[2] - xh[2] * yh[1], xh[2] * yh[0] - xh[0] * yh[2], xh[0] * yh[1] - xh[1] * yh[0])
    return xh, yh, zh


def halo_local(tmpl, mjd, mjd0, phase0=0.0):
    """Halo/Lissajous offset and velocity (km, km/day) in the L-point's local frame."""
    w = 2 * math.pi / tmpl["period"]
    ang = w * ((mjd - mjd0) + phase0)
    s = -1.0 if tmpl.get("south") else 1.0
    ax, ay, az = tmpl["Ax"], tmpl["Ay"], tmpl["Az"]
    # Classic halo: z is a quarter-period out of phase with y, so the path is a
    # 3-D loop rather than a flat tilted ellipse.
    x = -ax * math.cos(ang)
    y = ay * math.sin(ang)
    z = s * az * math.cos(ang)
    vx = ax * w * math.sin(ang)
    vy = ay * w * math.cos(ang)
    vz = -s * az * w * math.sin(ang)
    return (x, y, z), (vx, vy, vz)


def halo_offset(tmpl, mjd, mjd0, phase0=0.0):
    loc, _ = halo_local(tmpl, mjd + phase0, mjd0)
    return loc


def rotate_em(vec, moon):
    xh, yh, zh = em_basis(moon)
    return (
        vec[0] * xh[0] + vec[1] * yh[0] + vec[2] * zh[0],
        vec[0] * xh[1] + vec[1] * yh[1] + vec[2] * zh[1],
        vec[0] * xh[2] + vec[1] * yh[2] + vec[2] * zh[2],
    )


def halo_world(point, moon, rse, tmpl, mjd, mjd0, phase0=0.0):
    """Position of a modeled halo/Lissajous about `point` in the SE rotating frame."""
    c = point_pos(point, moon, rse)
    loc, _ = halo_local(tmpl, mjd, mjd0, phase0)
    if point.startswith("EM"):
        d = rotate_em(loc, moon)
        return (c[0] + d[0], c[1] + d[1], c[2] + d[2])
    return (c[0] + loc[0], c[1] + loc[1], c[2] + loc[2])


def halo_world_vel(point, moon, rse, tmpl, mjd, mjd0, moon_next=None, phase0=0.0):
    """Approximate SE-frame velocity (km/day) of a modeled halo spacecraft."""
    loc, vloc = halo_local(tmpl, mjd, mjd0, phase0)
    if point.startswith("EM"):
        # include motion of the L-point by differencing the world position
        p0 = halo_world(point, moon, rse, tmpl, mjd, mjd0, phase0)
        mo1 = moon_next if moon_next is not None else moon
        p1 = halo_world(point, mo1, rse, tmpl, mjd + 0.25, mjd0, phase0)
        return ((p1[0] - p0[0]) / 0.25, (p1[1] - p0[1]) / 0.25, (p1[2] - p0[2]) / 0.25)
    return vloc


def vclamp(v, dist, T, max_scale=1.05):
    speed = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    if T <= 0 or speed <= 0:
        return v
    if speed * T > max_scale * max(dist, 1.0):
        s = max_scale * dist / (speed * T)
        return (v[0] * s, v[1] * s, v[2] * s)
    return v


def hermite(p0, v0, p1, v1, u, T):
    """Cubic Hermite: velocities in km/day, T in days, u in [0,1]."""
    u = max(0.0, min(1.0, u))
    u2, u3 = u * u, u * u * u
    h00 = 2 * u3 - 3 * u2 + 1
    h10 = u3 - 2 * u2 + u
    h01 = -2 * u3 + 3 * u2
    h11 = u3 - u2
    return (
        h00 * p0[0] + h10 * T * v0[0] + h01 * p1[0] + h11 * T * v1[0],
        h00 * p0[1] + h10 * T * v0[1] + h01 * p1[1] + h11 * T * v1[1],
        h00 * p0[2] + h10 * T * v0[2] + h01 * p1[2] + h11 * T * v1[2],
    )


def transfer_curve(p0, p1, mjd, m0, m1, bend=1.0, v0=None, v1=None):
    """C1 coast from p0 to p1. Optional endpoint velocities in km/day."""
    if m1 <= m0:
        return p1
    T = m1 - m0
    u = (mjd - m0) / T
    dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
    dist = math.sqrt(dx * dx + dy * dy + dz * dz) or 1.0
    if v0 is None:
        v0 = (dx / T, dy / T, dz / T)
    if v1 is None:
        v1 = (dx / T, dy / T, dz / T)
    v0 = vclamp(v0, dist, T)
    v1 = vclamp(v1, dist, T)
    return hermite(p0, v0, p1, v1, u, T)


def finite_vel(pts, i):
    """km/day from neighbors."""
    if i <= 0:
        a, b = pts[0], pts[1]
    elif i >= len(pts) - 1:
        a, b = pts[-2], pts[-1]
    else:
        a, b = pts[i - 1], pts[i + 1]
    dt = b[0] - a[0]
    if abs(dt) < 1e-6:
        return (0.0, 0.0, 0.0)
    return ((b[1] - a[1]) / dt, (b[2] - a[2]) / dt, (b[3] - a[3]) / dt)


def blend_segments(prefix, suffix, window_days=8.0, step_days=0.5):
    """Join prefix → suffix with a cubic Hermite so position and velocity match."""
    if not prefix:
        return list(suffix)
    if not suffix:
        return list(prefix)
    t_join = suffix[0][0]
    t0 = t_join - window_days
    pre = [p for p in prefix if p[0] < t0 - 1e-6]
    # state at the start of the blend, from the prefix
    if not any(p[0] <= t0 for p in prefix):
        # prefix ends well before suffix; just connect last prefix to first suffix
        t0 = prefix[-1][0]
        pre = prefix[:-1]
    # interpolate prefix at t0
    def at(pts, t):
        if t <= pts[0][0]:
            return pts[0]
        if t >= pts[-1][0]:
            return pts[-1]
        lo, hi = 0, len(pts) - 1
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if pts[mid][0] <= t:
                lo = mid
            else:
                hi = mid
        a, b = pts[lo], pts[hi]
        s = (t - a[0]) / (b[0] - a[0] or 1)
        return (t, a[1] + s * (b[1] - a[1]), a[2] + s * (b[2] - a[2]), a[3] + s * (b[3] - a[3]))

    p0 = at(prefix, t0)
    p1 = suffix[0]
    # velocities
    # use prefix points around t0
    i0 = min(range(len(prefix)), key=lambda i: abs(prefix[i][0] - t0))
    i1 = 0
    v0 = finite_vel(prefix, i0)
    v1 = finite_vel(suffix, i1)
    T = p1[0] - p0[0]
    if T <= 0.05:
        return pre + list(suffix)
    mid = []
    t = t0
    while t < p1[0] - 1e-4:
        pos = hermite((p0[1], p0[2], p0[3]), v0, (p1[1], p1[2], p1[3]), v1, (t - t0) / T, T)
        mid.append((t, pos[0], pos[1], pos[2]))
        t += step_days
    return pre + mid + list(suffix)


def pack_traj(points):
    """points: list of (mjd, x, y, z) → compact dict with integer km and hours from first sample."""
    if not points:
        return None
    points = sorted(points, key=lambda p: p[0])
    t0 = points[0][0]
    buckets = {}
    for mjd, x, y, z in points:
        h = round((mjd - t0) * 24, 2)
        if h == int(h):
            h = int(h)
        buckets.setdefault(h, []).append((x, y, z))
    hours, xs, ys, zs = [], [], [], []
    for h in sorted(buckets):
        grp = buckets[h]
        n = len(grp)
        hours.append(h)
        xs.append(int(round(sum(p[0] for p in grp) / n)))
        ys.append(int(round(sum(p[1] for p in grp) / n)))
        zs.append(int(round(sum(p[2] for p in grp) / n)))
    return {"t0_mjd": round(t0, 6), "hours": hours, "x": xs, "y": ys, "z": zs, "n": len(hours)}


def measure_halo(points, point_name, moon_lookup, rse_lookup):
    """Estimate Ax,Ay,Az,period from rotating-frame samples during a stay."""
    if len(points) < 20:
        return None
    offs = []
    for mjd, x, y, z in points:
        moon = moon_lookup(mjd) if moon_lookup else None
        rse = rse_lookup(mjd) if rse_lookup else AU
        px, py, pz = point_pos(point_name, moon, rse)
        dx, dy, dz = x - px, y - py, z - pz
        # For EM points, measure in the Earth–Moon frame so the Moon's 27-day
        # motion does not leak into the halo period estimate.
        if point_name.startswith("EM") and moon:
            xh, yh, zh = em_basis(moon)
            locx = dx * xh[0] + dy * xh[1] + dz * xh[2]
            locy = dx * yh[0] + dy * yh[1] + dz * yh[2]
            locz = dx * zh[0] + dy * zh[1] + dz * zh[2]
            offs.append((mjd, locx, locy, locz))
        else:
            offs.append((mjd, dx, dy, dz))
    # Period from y zero-crossings or autocorrelation on y
    ys = [o[2] for o in offs]
    dt = (offs[-1][0] - offs[0][0]) / (len(offs) - 1)
    # Autocorrelation peak after a minimum lag of ~60 days for SE, 8 for EM
    min_lag = 60 if point_name.startswith("SE") else 8
    max_lag = 250 if point_name.startswith("SE") else 25
    min_i = max(1, int(min_lag / dt))
    max_i = min(len(ys) - 2, int(max_lag / dt))
    best_i, best_c = min_i, -1e99
    mean = sum(ys) / len(ys)
    var = sum((y - mean) ** 2 for y in ys) or 1
    for lag in range(min_i, max_i + 1):
        c = sum((ys[i] - mean) * (ys[i + lag] - mean) for i in range(len(ys) - lag))
        if c > best_c:
            best_c, best_i = c, lag
    period = best_i * dt
    ax = sorted(abs(o[1]) for o in offs)[int(0.95 * len(offs))]
    ay = sorted(abs(o[2]) for o in offs)[int(0.95 * len(offs))]
    az = sorted(abs(o[3]) for o in offs)[int(0.95 * len(offs))]
    return {"Ax": ax, "Ay": ay, "Az": az, "period": period, "south": (sum(1 for o in offs if o[3] < 0) > len(offs) / 2)}



def dist3p(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def tmpl_from_meas(meas, point):
    base = dict(HALO_TEMPLATES[point])
    if not meas:
        return base
    base["Ax"] = meas.get("Ax", base["Ax"])
    base["Ay"] = meas.get("Ay", base["Ay"])
    base["Az"] = meas.get("Az", base["Az"])
    if meas.get("period") and 5 < meas["period"] < 400:
        base["period"] = meas["period"]
    if "south" in meas:
        base["south"] = meas["south"]
    return base


def best_phase(point, moon_at, tmpl, t_join, target, mjd0, n=96):
    """Phase (days) that puts the modeled halo nearest target at t_join."""
    best_ph, best_d = 0.0, 1e99
    period = tmpl.get("period") or 178.0
    for i in range(n):
        ph = period * i / n
        moon, rse = moon_at(t_join)
        pos = halo_world(point, moon, rse, tmpl, t_join, mjd0, phase0=ph)
        d = dist3p(pos, target)
        if d < best_d:
            best_d, best_ph = d, ph
    return best_ph, best_d


def adaptive_blend(prefix, suffix, min_days=8.0, max_days=90.0, step_days=0.5):
    if not prefix or not suffix:
        return blend_segments(prefix, suffix, window_days=min_days, step_days=step_days)
    gap = dist3p(prefix[-1][1:], suffix[0][1:])
    # Slow the splice so a residual position mismatch is a gentle curve.
    window = min(max_days, max(min_days, gap / 8000.0))
    return blend_segments(prefix, suffix, window_days=window, step_days=step_days), window, gap


def model_mission(m, moon_series, earth_series, sun_series, step_days=0.5, tmpl_override=None, phase0=0.0):
    start = iso2date(m["appear_start"])
    end = iso2date(m["appear_end"])
    stays = m["stays"]
    first_arr = iso2date(stays[0]["arrival"])
    tmpl0 = dict(tmpl_override or HALO_OVERRIDE.get(m["id"], HALO_TEMPLATES[stays[0]["point"]]))
    points = []
    mjd = d2mjd(start)
    mjd_end = d2mjd(end) + 0.99
    mjd0 = d2mjd(first_arr)

    def moon_at(mjd):
        e = interp(earth_series, mjd)
        s = interp(sun_series, mjd)
        mo = interp(moon_series, mjd)
        if not (e and s and mo):
            return (A_MOON, 0.0, 0.0), AU
        mx, my, mz, rse = to_rot(mo, e, s)
        return (mx, my, mz), rse

    def tmpl_for(point):
        if tmpl_override:
            return dict(tmpl_override)
        return dict(HALO_OVERRIDE.get(m["id"], HALO_TEMPLATES[point]))

    def world(point, moon, rse, mjd, tmpl=None):
        return halo_world(point, moon, rse, tmpl or tmpl_for(point), mjd, mjd0, phase0=phase0)

    def vel_at(point, moon, rse, mjd, tmpl=None):
        mo2, _ = moon_at(mjd + 0.25)
        return halo_world_vel(point, moon, rse, tmpl or tmpl_for(point), mjd, mjd0, moon_next=mo2, phase0=phase0)

    while mjd <= mjd_end:
        moon, rse = moon_at(mjd)
        pos = None
        if mjd < d2mjd(first_arr):
            t_arr = d2mjd(first_arr)
            moon_arr, rse_arr = moon_at(t_arr)
            dest = world(stays[0]["point"], moon_arr, rse_arr, t_arr)
            v1 = vel_at(stays[0]["point"], moon_arr, rse_arr, t_arr)
            if m["id"] in ("change2", "change5", "change6", "ce5t1"):
                p0 = moon
                # leave the Moon toward the destination
                T = d2mjd(first_arr) - d2mjd(start) or 1
                v0 = ((dest[0] - p0[0]) / T, (dest[1] - p0[1]) / T, (dest[2] - p0[2]) / T)
            else:
                p0 = (42264.0, 0.0, 0.0)  # high Earth orbit, not the surface
                T = d2mjd(first_arr) - d2mjd(start) or 1
                v0 = ((dest[0] - p0[0]) / T, (dest[1] - p0[1]) / T, (dest[2] - p0[2]) / T)
            pos = transfer_curve(p0, dest, mjd, d2mjd(start), d2mjd(first_arr), v0=v0, v1=v1)
        else:
            active = None
            for i, st in enumerate(stays):
                a = d2mjd(iso2date(st["arrival"]))
                b = d2mjd(iso2date(st["departure"])) if st["departure"] else mjd_end + 10
                if a <= mjd <= b:
                    active = st
                    break
                if st["departure"] and i + 1 < len(stays):
                    nxt = stays[i + 1]
                    t0 = d2mjd(iso2date(st["departure"]))
                    t1 = d2mjd(iso2date(nxt["arrival"]))
                    if t0 < mjd < t1:
                        mo0, r0 = moon_at(t0)
                        mo1, r1 = moon_at(t1)
                        p0 = world(st["point"], mo0, r0, t0)
                        p1 = world(nxt["point"], mo1, r1, t1)
                        v0 = vel_at(st["point"], mo0, r0, t0)
                        v1 = vel_at(nxt["point"], mo1, r1, t1)
                        pos = transfer_curve(p0, p1, mjd, t0, t1, v0=v0, v1=v1)
                        break
            if pos is None and active:
                pos = world(active["point"], moon, rse, mjd)
            elif pos is None:
                dep = stays[-1]["departure"]
                if dep:
                    t0 = d2mjd(iso2date(dep))
                    t1 = t0 + 60
                    mo0, r0 = moon_at(t0)
                    p0 = world(stays[-1]["point"], mo0, r0, t0)
                    v0 = vel_at(stays[-1]["point"], mo0, r0, t0)
                    if stays[-1]["point"].startswith("EM"):
                        # Leaving an Earth–Moon point means going back to the
                        # Moon (Chang'e 5-T1 entered lunar orbit). Model the
                        # leg relative to the Moon so it keeps moving with it
                        # instead of stopping dead in the rotating frame.
                        T = 7.0
                        mo_n, _ = moon_at(t0 + 0.25)
                        vm = ((mo_n[0] - mo0[0]) / 0.25, (mo_n[1] - mo0[1]) / 0.25, (mo_n[2] - mo0[2]) / 0.25)
                        off0 = (p0[0] - mo0[0], p0[1] - mo0[1], p0[2] - mo0[2])
                        voff0 = (v0[0] - vm[0], v0[1] - vm[1], v0[2] - vm[2])
                        off1 = (0.0, 0.0, -2500.0)
                        u = min(1.0, (mjd - t0) / T)
                        u2, u3 = u * u, u * u * u
                        h00, h10, h01 = 2 * u3 - 3 * u2 + 1, u3 - 2 * u2 + u, -2 * u3 + 3 * u2
                        off = tuple(h00 * off0[k] + h10 * T * voff0[k] + h01 * off1[k] for k in range(3))
                        pos = (moon[0] + off[0], moon[1] + off[1], moon[2] + off[2])
                        points.append((mjd, pos[0], pos[1], pos[2]))
                        mjd += step_days
                        continue
                    sign = 1.0 if stays[-1]["point"].endswith("L2") else -1.0
                    scale = 1.0 if stays[-1]["point"].startswith("SE") else 0.12
                    p1 = (p0[0] + sign * 500000 * scale, p0[1] + 300000 * scale, p0[2] + 80000 * scale)
                    v1 = ((p1[0] - p0[0]) / 60, (p1[1] - p0[1]) / 60, (p1[2] - p0[2]) / 60)
                    pos = transfer_curve(p0, p1, mjd, t0, t1, v0=v0, v1=v1, bend=0.4)
        if pos:
            points.append((mjd, pos[0], pos[1], pos[2]))
        mjd += step_days
    return points




def close_approach_windows(pts, r_km=150000, moon_pad=40000, pad_days=2.0, merge_days=3, max_days=16, moon_lookup=None):
    """Return padded [mjd0, mjd1] windows where the craft is near Earth or the Moon."""
    wins = []
    cur = None
    for mjd, x, y, z in pts:
        r = math.sqrt(x * x + y * y + z * z)
        near = r < r_km
        if not near and moon_lookup is not None:
            mo = moon_lookup(mjd)
            if mo:
                md = math.sqrt((x - mo[0]) ** 2 + (y - mo[1]) ** 2 + (z - mo[2]) ** 2)
                near = md < moon_pad
        if near:
            if cur is None:
                cur = [mjd, mjd]
            else:
                cur[1] = mjd
        elif cur is not None:
            wins.append(cur)
            cur = None
    if cur:
        wins.append(cur)
    out = []
    for a, b in wins:
        a -= pad_days
        b += pad_days
        # Split very long windows so we don't request months of 1-hour data.
        if b - a > max_days:
            t = a
            while t < b:
                out.append([t, min(t + max_days, b)])
                t += max_days
            continue
        if out and a - out[-1][1] <= merge_days:
            out[-1][1] = b
        else:
            out.append([a, b])
    return out


def merge_raw(raw, extra):
    if not extra:
        return raw
    seen = {round(r[0], 6) for r in raw}
    out = list(raw)
    for r in extra:
        k = round(r[0], 6)
        if k not in seen:
            seen.add(k)
            out.append(r)
    out.sort(key=lambda r: r[0])
    return out


# Rotating-frame velocities (km/day) of Horizons samples, keyed by mjd, for the
# mission currently being processed. Used for Hermite resampling at the end.
ROT_STATES = {}


def transform_raw(raw, earth, sun):
    pts = []
    for r in raw:
        e = interp(earth, r[0])
        s = interp(sun, r[0])
        if not e or not s:
            continue
        x, y, z, _rse = to_rot(r[1:4], e, s)
        pts.append((r[0], x, y, z))
        if len(r) >= 7 and any(r[4:7]) and len(e) >= 6:
            xh, yh, zh, rn = rot_frame(e, s)
            rv = (r[4] - e[3], r[5] - e[4], r[6] - e[5])
            rex, rey, rez = e[0] - s[0], e[1] - s[1], e[2] - s[2]
            vex, vey, vez = e[3] - s[3], e[4] - s[4], e[5] - s[5]
            hx, hy, hz = rey * vez - rez * vey, rez * vex - rex * vez, rex * vey - rey * vex
            w = math.sqrt(hx * hx + hy * hy + hz * hz) / (rn * rn)
            vx = rv[0] * xh[0] + rv[1] * xh[1] + rv[2] * xh[2] + w * y
            vy = rv[0] * yh[0] + rv[1] * yh[1] + rv[2] * yh[2] - w * x
            vz = rv[0] * zh[0] + rv[1] * zh[1] + rv[2] * zh[2]
            ROT_STATES[round(r[0], 6)] = (x, y, z, vx * 86400.0, vy * 86400.0, vz * 86400.0)
    return pts


def downsample(points, max_pts=25000, cruise_hours=24, near_km=150000, moon_lookup=None):
    """Keep every sample near Earth/Moon; never thin cruise samples coarser than ~1 day."""
    if not points:
        return points
    if len(points) <= 3:
        return points
    out = [points[0]]
    for i in range(1, len(points) - 1):
        r = math.sqrt(points[i][1] ** 2 + points[i][2] ** 2 + points[i][3] ** 2)
        dt_h = (points[i][0] - out[-1][0]) * 24
        near = r < near_km
        if not near and moon_lookup is not None:
            mo = moon_lookup(points[i][0])
            if mo:
                md = math.sqrt((points[i][1] - mo[0]) ** 2 + (points[i][2] - mo[1]) ** 2 + (points[i][3] - mo[2]) ** 2)
                near = md < 40000
        if near or dt_h >= cruise_hours - 1e-6:
            out.append(points[i])
    if out[-1] is not points[-1]:
        out.append(points[-1])
    if len(out) > max_pts:
        # Thin only samples denser than 18 h; never go coarser than one day.
        keep = [out[0]]
        for i in range(1, len(out) - 1):
            dt_h = (out[i][0] - keep[-1][0]) * 24
            r = math.sqrt(out[i][1] ** 2 + out[i][2] ** 2 + out[i][3] ** 2)
            near = r < near_km
            if near or dt_h >= 18.0 or len(keep) + (len(out) - i) <= max_pts:
                keep.append(out[i])
        keep.append(out[-1])
        out = keep
    return out


def despike(points, max_deg=28.0, moon_lookup=None, min_seg_km=200):
    """Remove isolated non-flyby detours that make a sharp corner."""
    if len(points) < 5:
        return points
    pts = list(points)

    def r_of(p):
        return math.sqrt(p[1] ** 2 + p[2] ** 2 + p[3] ** 2)

    def is_flyby(p):
        if r_of(p) < 50000:
            return True
        if moon_lookup is not None:
            mo = moon_lookup(p[0])
            if mo:
                md = math.sqrt((p[1] - mo[0]) ** 2 + (p[2] - mo[1]) ** 2 + (p[3] - mo[2]) ** 2)
                if md < 50000:
                    return True
        return False

    def ang(a, b, c):
        u = (b[1] - a[1], b[2] - a[2], b[3] - a[3])
        v = (c[1] - b[1], c[2] - b[2], c[3] - b[3])
        nu = math.sqrt(u[0] ** 2 + u[1] ** 2 + u[2] ** 2)
        nv = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
        if nu < min_seg_km or nv < min_seg_km:
            return 0.0, nu + nv, math.sqrt((c[1] - a[1]) ** 2 + (c[2] - a[2]) ** 2 + (c[3] - a[3]) ** 2)
        dot = max(-1.0, min(1.0, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (nu * nv)))
        chord = math.sqrt((c[1] - a[1]) ** 2 + (c[2] - a[2]) ** 2 + (c[3] - a[3]) ** 2)
        return math.degrees(math.acos(dot)), nu + nv, chord

    changed = True
    rounds = 0
    removed = 0
    while changed and rounds < 4:
        changed = False
        rounds += 1
        keep = [pts[0]]
        i = 1
        while i < len(pts) - 1:
            a, b, c = keep[-1], pts[i], pts[i + 1]
            deg, path, chord = ang(a, b, c)
            detour = path > 1e-6 and chord < 0.85 * path
            short = (c[0] - a[0]) < 5.0
            if deg >= max_deg and not is_flyby(b) and detour and short:
                # drop b
                changed = True
                removed += 1
                i += 1
                continue
            keep.append(b)
            i += 1
        keep.append(pts[-1])
        pts = keep
    if removed:
        print(f"    despike removed {removed} outlier sample(s)", flush=True)
    return pts


def main():
    print(f"SE-L1 distance {SE_L1_DIST:.0f} km, SE-L2 {SE_L2_DIST:.0f} km", flush=True)
    print(f"EM-L1 distance {EM_L1_DIST:.0f} km, EM-L2 {EM_L2_DIST:.0f} km", flush=True)

    body_start = date(1978, 8, 1)
    body_stop = date(2026, 11, 17)

    print("Fetching Sun, Earth, Moon…", flush=True)
    sun = fetch_series("10", body_start, body_stop, "12 h")
    earth = fetch_series("399", body_start, body_stop, "12 h")
    moon_ssb = fetch_series("301", body_start, body_stop, "12 h")
    print(f"  Sun {len(sun)}  Earth {len(earth)}  Moon {len(moon_ssb)}", flush=True)

    # Moon and r_se in rotating frame, 12-hour grid
    moon_rot = []
    rse_series = []
    for row in earth:
        mjd = row[0]
        s = interp(sun, mjd)
        mo = interp(moon_ssb, mjd)
        if not s or not mo:
            continue
        mx, my, mz, rse = to_rot(mo, row[1:], s)
        moon_rot.append((mjd, mx, my, mz))
        rse_series.append((mjd, rse))

    def moon_lookup(mjd):
        # interpolate moon_rot
        if not moon_rot:
            return (A_MOON, 0.0, 0.0)
        # binary search
        lo, hi = 0, len(moon_rot) - 1
        if mjd <= moon_rot[0][0]:
            return moon_rot[0][1:]
        if mjd >= moon_rot[-1][0]:
            return moon_rot[-1][1:]
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if moon_rot[mid][0] <= mjd:
                lo = mid
            else:
                hi = mid
        a, b = moon_rot[lo], moon_rot[hi]
        t = (mjd - a[0]) / (b[0] - a[0] or 1)
        return (a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2]), a[3] + t * (b[3] - a[3]))

    def rse_lookup(mjd):
        if not rse_series:
            return AU
        lo, hi = 0, len(rse_series) - 1
        if mjd <= rse_series[0][0]:
            return rse_series[0][1]
        if mjd >= rse_series[-1][0]:
            return rse_series[-1][1]
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if rse_series[mid][0] <= mjd:
                lo = mid
            else:
                hi = mid
        a, b = rse_series[lo], rse_series[hi]
        t = (mjd - a[0]) / (b[0] - a[0] or 1)
        return a[1] + t * (b[1] - a[1])

    def moon_at_join(mjd):
        return moon_lookup(mjd), rse_lookup(mjd)

    traj = {}
    sources = {}
    measured = {}


    for m in MISSIONS:
        hid = m.get("horizons")
        ROT_STATES.clear()
        start = iso2date(m["appear_start"])
        end = iso2date(m["appear_end"])
        points = None
        src = "modeled"
        if hid is not None:
            try:
                # 1-day steps; 12 h for shorter / EM missions
                span = (end - start).days
                step = "12 h" if (span < 800 or m["id"].startswith("artemis")) else "1 d"
                print(f"Fetching {m['name']} ({hid}) {start}–{end}", flush=True)
                raw = []
                # Cruise (or 12 h) over the full span; clips to Horizons coverage.
                # If the first 90 mission days have no coverage (e.g. ACE), this
                # still returns later years instead of aborting the whole fetch.
                try:
                    raw = fetch_series(str(hid), start, end, step)
                except RuntimeError as e:
                    if "no overlap" not in str(e):
                        raise
                    raw = []
                if raw:
                    cov_start = mjd2date(raw[0][0])
                    fine_end = min(end, cov_start + timedelta(days=90))
                    if (fine_end - cov_start).days >= 2:
                        try:
                            fine = fetch_series(str(hid), cov_start, fine_end, "6 h")
                            if fine:
                                t0, t1 = fine[0][0] - 1e-6, fine[-1][0] + 1e-6
                                raw = [r for r in raw if r[0] < t0 or r[0] > t1] + fine
                                raw.sort(key=lambda r: r[0])
                        except RuntimeError as e:
                            print(f"  fine-window skip: {e}", flush=True)
                    # Densify close Earth/Moon approaches (petal flybys, lunar swings).
                print(f"  {len(raw)} raw states", flush=True)
                pts = transform_raw(raw, earth, sun)
                if len(pts) < 8:
                    raise RuntimeError(f"too few transformed points ({len(pts)})")
                windows = close_approach_windows(pts, moon_lookup=moon_lookup)
                if windows:
                    print(f"  densifying {len(windows)} close-approach window(s) at 1 h", flush=True)
                    extra = []
                    for a, b in windows:
                        da, db = mjd2date(a), mjd2date(b)
                        if db <= da:
                            db = da + timedelta(days=1)
                        try:
                            extra.extend(fetch_series(str(hid), da, db, "1 h"))
                        except Exception as e:
                            print(f"    close-approach skip {da}–{db}: {e}", flush=True)
                    if extra:
                        raw = merge_raw(raw, extra)
                        pts = transform_raw(raw, earth, sun)
                # Even denser sampling around close Earth perigees (phasing orbits).
                tight = close_approach_windows(pts, r_km=25000, moon_pad=0, pad_days=0.6, merge_days=1, max_days=4, moon_lookup=None)
                if tight:
                    print(f"  densifying {len(tight)} perigee window(s) at 15 min", flush=True)
                    extra = []
                    for a, b in tight:
                        da, db = mjd2date(a), mjd2date(b)
                        if db <= da:
                            db = da + timedelta(days=1)
                        try:
                            extra.extend(fetch_series(str(hid), da, db, "15 m"))
                        except Exception as e:
                            print(f"    perigee skip {da}–{db}: {e}", flush=True)
                    if extra:
                        raw = merge_raw(raw, extra)
                        pts = transform_raw(raw, earth, sun)
                first = pts[0][0]
                want = d2mjd(start)
                step_d = 0.5 if any(st["point"].startswith("EM") for st in m["stays"]) else 1.0
                stitched = False
                # Prefer amplitudes measured from the real Horizons stay, and a
                # halo phase that meets the first/last Horizons sample, so the
                # blend is a small C1 splice instead of a hook across a gap.
                def meas_for_point(point_name, lo, hi):
                    occ = [p for p in pts if lo <= p[0] <= hi]
                    return measure_halo(occ, point_name, moon_lookup, rse_lookup)

                if first > want + 3:
                    print(f"  stitching modeled prefix {start.isoformat()} → {mjd2iso(first)}", flush=True)
                    t_arr0 = d2mjd(iso2date(m["stays"][0]["arrival"]))
                    if first <= t_arr0 + 2:
                        # Horizons starts during the outbound transfer. Connect
                        # launch to the first measured state; do not aim at a halo.
                        def moon_pos(t):
                            mo, _r = moon_at_join(t)
                            return mo
                        if m["id"] in ("change2", "change5", "change6", "ce5t1"):
                            p0 = moon_pos(want)
                        else:
                            p0 = (42264.0, 0.0, 0.0)
                        p1 = pts[0][1:]
                        v1 = finite_vel(pts, 0)
                        T = first - want or 1.0
                        v0 = ((p1[0] - p0[0]) / T, (p1[1] - p0[1]) / T, (p1[2] - p0[2]) / T)
                        prefix = []
                        t = want
                        while t < first - 0.05:
                            pos = transfer_curve(p0, p1, t, want, first, v0=v0, v1=v1)
                            prefix.append((t, pos[0], pos[1], pos[2]))
                            t += min(0.5, step_d)
                        print(f"    transfer prefix to first Horizons sample, {len(prefix)} pts", flush=True)
                    else:
                        point0 = m["stays"][0]["point"]
                        meas = meas_for_point(point0, first, first + 400)
                        tmpl = tmpl_from_meas(meas, point0)
                        if m["id"] in HALO_OVERRIDE and not meas:
                            tmpl = dict(HALO_OVERRIDE[m["id"]])
                        target = pts[0][1:]
                        ph, dmatch = best_phase(point0, moon_at_join, tmpl, first, target, t_arr0)
                        print(f"    prefix phase {ph:.1f}d, join mismatch {dmatch:.0f} km", flush=True)
                        prefix = model_mission(m, moon_ssb, earth, sun, step_days=min(0.5, step_d), tmpl_override=tmpl, phase0=ph)
                        prefix = [pr for pr in prefix if pr[0] < first - 0.05]
                    pts, win, gap = adaptive_blend(prefix, pts)
                    print(f"    prefix blend window {win:.1f}d, raw gap {gap:.0f} km", flush=True)
                    stitched = True
                last = pts[-1][0]
                need = d2mjd(end)
                if last < need - 3:
                    print(f"  stitching modeled suffix {mjd2iso(last)} → {end.isoformat()}", flush=True)
                    # last stay whose arrival is at or before the join
                    point1 = m["stays"][0]["point"]
                    for st in m["stays"]:
                        if d2mjd(iso2date(st["arrival"])) <= last:
                            point1 = st["point"]
                    meas = meas_for_point(point1, last - 400, last)
                    tmpl = tmpl_from_meas(meas, point1)
                    if m["id"] in HALO_OVERRIDE and not meas:
                        tmpl = dict(HALO_OVERRIDE[m["id"]])
                    target = pts[-1][1:]
                    ph, dmatch = best_phase(point1, moon_at_join, tmpl, last, target, d2mjd(iso2date(m["stays"][0]["arrival"])))
                    print(f"    suffix phase {ph:.1f}d, join mismatch {dmatch:.0f} km", flush=True)
                    suffix = model_mission(m, moon_ssb, earth, sun, step_days=min(0.5, step_d), tmpl_override=tmpl, phase0=ph)
                    suffix = [su for su in suffix if su[0] > last + 0.05]
                    pts, win, gap = adaptive_blend(pts, suffix)
                    print(f"    suffix blend window {win:.1f}d, raw gap {gap:.0f} km", flush=True)
                    stitched = True
                src = "horizons+modeled" if stitched else "horizons"
                points = pts
            except Exception as e:
                print(f"  Horizons failed for {m['id']}: {e} — falling back to model", flush=True)
                points = None
        if points is None:
            print(f"Modeling {m['name']}", flush=True)
            step = 0.5 if any(st["point"].startswith("EM") for st in m["stays"]) else 1.0
            points = model_mission(m, moon_ssb, earth, sun, step_days=step)
            src = "modeled"
        n_in = len(points)
        if os.environ.get("LAGRANGE_DUMP"):
            import pickle
            Path(os.environ["LAGRANGE_DUMP"]).mkdir(parents=True, exist_ok=True)
            with open(Path(os.environ["LAGRANGE_DUMP"]) / f"{m['id']}.pkl", "wb") as fh:
                pickle.dump({"points": points, "states": dict(ROT_STATES), "moon": moon_rot}, fh)
        if os.environ.get("LAGRANGE_DUMP_ONLY"):
            continue
        points = smooth_track(points, ROT_STATES, moon_lookup, log=lambda msg: print(msg, flush=True))
        print(f"  smooth resample {n_in} → {len(points)} pts", flush=True)
        traj[m["id"]] = pack_traj(points)
        sources[m["id"]] = src
        # Measure halo from occupation samples of the first long stay
        for st in m["stays"]:
            a = d2mjd(iso2date(st["arrival"]))
            b = d2mjd(iso2date(st["departure"])) if st["departure"] else d2mjd(end)
            occ = [p for p in points if a + 5 <= p[0] <= b - 2]
            meas = measure_halo(occ, st["point"], moon_lookup, rse_lookup)
            if meas:
                measured.setdefault(m["id"], {})[st["point"]] = meas
                print(f"  {m['id']} {st['point']} amplitudes Ax={meas['Ax']:.0f} Ay={meas['Ay']:.0f} Az={meas['Az']:.0f} P={meas['period']:.1f}d", flush=True)

    # Pack moon at 1-day (enough for a smooth orbit line with interpolation)
    moon_daily = [p for i, p in enumerate(moon_rot) if i % 2 == 0]  # 12h → 1d
    moon_pack = pack_traj(moon_daily)

    # r_se daily (for instantaneous L1/L2 markers)
    rse_daily = []
    hours = []
    t0 = rse_series[0][0]
    last_h = -999
    rse_vals = []
    for mjd, rse in rse_series:
        h = int(round((mjd - t0) * 24))
        if h - last_h >= 24:
            hours.append(h)
            rse_vals.append(int(round(rse)))
            last_h = h

    def delta_pack(pk):
        """Delta-encode a pack (lossless): hours become centi-hour steps and
        each coordinate array becomes successive differences. Decoded by
        decodePack() in lagrange.js."""
        if not pk:
            return pk
        out = {k: v for k, v in pk.items()}
        ch = [int(round(h * 100)) for h in pk["hours"]]
        out["hours"] = [ch[0]] + [ch[i] - ch[i - 1] for i in range(1, len(ch))]
        for key in ("x", "y", "z", "km"):
            if key in pk:
                a = pk[key]
                out[key] = [a[0]] + [a[i] - a[i - 1] for i in range(1, len(a))]
        out["d"] = 1
        return out

    out_traj = {
        "as_of": ASOF.isoformat(),
        "frame": "Earth-centered Sun–Earth rotating frame. +X points from the Sun through Earth; +Z follows Earth’s orbital angular momentum. Units are kilometres.",
        "constants": {
            "se_l1_km": round(SE_L1_DIST),
            "se_l2_km": round(SE_L2_DIST),
            "em_l1_km": round(EM_L1_DIST),
            "em_l2_km": round(EM_L2_DIST),
            "au_km": AU,
            "earth_radius_km": 6378.137,
            "moon_radius_km": 1737.4,
        },
        "moon": delta_pack(moon_pack),
        "r_se": delta_pack({"t0_mjd": round(t0, 6), "hours": hours, "km": rse_vals}),
        "spacecraft": {k: delta_pack(v) for k, v in traj.items()},
        "sources": sources,
        "measured_halos": measured,
    }

    DATA.mkdir(parents=True, exist_ok=True)
    # Missions file (web catalog)
    missions_out = {
        "as_of": ASOF.isoformat(),
        "gcat_update": "2026-11-15",
        "count": len(MISSIONS),
        "missions": [],
        "points": {
            "SE-L1": {
                "name": "Sun–Earth L1",
                "short": "SE-L1",
                "summary": "Sun–Earth L1 lies about 1.5 million kilometres sunward of Earth, where the gravitational pull of the Sun and Earth, together with the orbital motion, allow a spacecraft to remain in a halo or Lissajous orbit and watch the Sun and the solar wind continuously.",
            },
            "SE-L2": {
                "name": "Sun–Earth L2",
                "short": "SE-L2",
                "summary": "Sun–Earth L2 lies about 1.5 million kilometres beyond Earth, opposite the Sun. A spacecraft there stays lined up with Earth as both travel around the Sun, which suits cold, stable observatories such as Webb, Euclid, Gaia, and Roman.",
            },
            "EM-L1": {
                "name": "Earth–Moon L1",
                "short": "EM-L1",
                "summary": "Earth–Moon L1 lies between the Earth and the Moon, roughly 58,000 to 61,000 kilometres from the Moon. ARTEMIS P1 and P2 were the first spacecraft to occupy this point, in 2010–2011, before entering lunar orbit.",
            },
            "EM-L2": {
                "name": "Earth–Moon L2",
                "short": "EM-L2",
                "summary": "Earth–Moon L2 lies beyond the Moon, about 64,500 kilometres farther from Earth. It is a natural place for a far-side communications relay. Queqiao has occupied a halo orbit there since 2018; ARTEMIS P1 and Chang'e 5-T1 visited earlier.",
            },
            "SE-L3": {
                "name": "Sun–Earth L3",
                "short": "SE-L3",
                "summary": "Sun–Earth L3 lies on the far side of the Sun, opposite Earth. No artificial spacecraft has been stationed there.",
            },
            "SE-L4": {
                "name": "Sun–Earth L4",
                "short": "SE-L4",
                "summary": "Sun–Earth L4 leads Earth in its orbit by 60 degrees, about 150 million kilometres away. No spacecraft has been stationed there; STEREO-A and OSIRIS-REx passed through the region on other missions.",
            },
            "SE-L5": {
                "name": "Sun–Earth L5",
                "short": "SE-L5",
                "summary": "Sun–Earth L5 trails Earth in its orbit by 60 degrees, about 150 million kilometres away. No spacecraft has been stationed there; STEREO-B and Hayabusa2 passed through the region on other missions.",
            },
        },
    }
    for m in MISSIONS:
        item = {k: m[k] for k in m if k != "horizons"}
        item["horizons_id"] = m.get("horizons")
        item["source"] = sources.get(m["id"], "modeled")
        src = sources.get(m["id"], "modeled")
        if m.get("approximate") or src == "modeled":
            item["approximate"] = True
        if src == "horizons+modeled":
            item["approximate"] = True
            item["source_note"] = "Part of this path is modeled; the rest follows JPL Horizons."
        elif src == "modeled":
            item["source_note"] = "This path is modeled from published dates and typical halo amplitudes; no public Horizons ephemeris covered the flight."
        missions_out["missions"].append(item)

    (DATA / "lagrange-missions.json").write_text(json.dumps(missions_out, indent=2) + "\n")
    (DATA / "lagrange-traj.json").write_text(json.dumps(out_traj, separators=(",", ":")) + "\n")
    print("Wrote", DATA / "lagrange-missions.json", "and", DATA / "lagrange-traj.json")
    print("traj size", (DATA / "lagrange-traj.json").stat().st_size, "bytes")
    print("sources", sources)


if __name__ == "__main__":
    main()
