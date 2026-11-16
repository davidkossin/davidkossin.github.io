#!/usr/bin/env python3
"""Flag sharp turns in Lagrange trajectory data.

Usage: python3 audit_lagrange.py [--traj PATH] [--max-deg 30]
Exit code 1 if any non-flyby turn exceeds the threshold.
"""
from __future__ import annotations

import json, math, sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lagrange_smooth import catmull_dense, display_turns  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TRAJ = ROOT / "data" / "lagrange-traj.json"
DEFAULT_MISSIONS = ROOT / "data" / "lagrange-missions.json"

EARTH_FLYBY_KM = 50000
MOON_FLYBY_KM = 50000


def iso_mjd(iso: str) -> float:
    d = date.fromisoformat(iso[:10])
    return d.toordinal() - date(1858, 11, 17).toordinal()


def mjd_iso(mjd: float) -> str:
    whole = int(math.floor(mjd))
    frac = mjd - whole
    d = date(1858, 11, 17) + timedelta(days=whole)
    seconds = int(round(frac * 86400))
    if seconds == 86400:
        d += timedelta(days=1)
        seconds = 0
    h, rem = divmod(seconds, 3600)
    mi, s = divmod(rem, 60)
    return f"{d.isoformat()} {h:02d}:{mi:02d}"


def decode(pack):
    if not pack.get("d"):
        return pack
    out = dict(pack)
    acc = 0
    hrs = []
    for v in pack["hours"]:
        acc += v
        hrs.append(acc / 100.0)
    out["hours"] = hrs
    for key in ("x", "y", "z", "km"):
        if key in pack:
            acc = 0
            arr = []
            for v in pack[key]:
                acc += v
                arr.append(acc)
            out[key] = arr
    out["d"] = 0
    return out


def unpack(pack):
    pack = decode(pack)
    t0 = pack["t0_mjd"]
    return [
        (t0 + pack["hours"][i] / 24, pack["x"][i], pack["y"][i], pack["z"][i])
        for i in range(pack["n"])
    ]


def hypot3(x, y, z):
    return math.sqrt(x * x + y * y + z * z)


def interp_moon(moon_pts, mjd):
    if not moon_pts:
        return None
    if mjd <= moon_pts[0][0]:
        return moon_pts[0][1:]
    if mjd >= moon_pts[-1][0]:
        return moon_pts[-1][1:]
    lo, hi = 0, len(moon_pts) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if moon_pts[mid][0] <= mjd:
            lo = mid
        else:
            hi = mid
    a, b = moon_pts[lo], moon_pts[hi]
    t = (mjd - a[0]) / (b[0] - a[0] or 1)
    return (a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2]), a[3] + t * (b[3] - a[3]))


def turns(pts, moon_pts, min_seg_km=200):
    out = []
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        u = (b[1] - a[1], b[2] - a[2], b[3] - a[3])
        v = (c[1] - b[1], c[2] - b[2], c[3] - b[3])
        nu, nv = hypot3(*u), hypot3(*v)
        if nu < min_seg_km or nv < min_seg_km:
            continue
        # skip zero-time packed collisions
        if abs(c[0] - a[0]) < 1e-6:
            continue
        dot = max(-1.0, min(1.0, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (nu * nv)))
        ang = math.degrees(math.acos(dot))
        r = hypot3(b[1], b[2], b[3])
        flyby = r < EARTH_FLYBY_KM
        mo = interp_moon(moon_pts, b[0])
        if mo:
            md = hypot3(b[1] - mo[0], b[2] - mo[1], b[3] - mo[2])
            if md < MOON_FLYBY_KM:
                flyby = True
        out.append({"i": i, "deg": ang, "mjd": b[0], "r": r, "flyby": flyby, "ds": nu, "dn": nv})
    return out


def main(argv=None):
    argv = argv or sys.argv[1:]
    traj_path = DEFAULT_TRAJ
    max_deg = 30.0
    i = 0
    while i < len(argv):
        if argv[i] == "--traj":
            traj_path = Path(argv[i + 1]); i += 2
        elif argv[i] == "--max-deg":
            max_deg = float(argv[i + 1]); i += 2
        else:
            print("unknown arg", argv[i]); return 2
    traj = json.loads(Path(traj_path).read_text())
    print(f"Auditing {traj_path}  threshold {max_deg}°")
    moon_pts = unpack(traj["moon"]) if traj.get("moon") else []
    worst_raw = 0
    n_raw_bad = 0
    n_raw_flyby = 0
    for mid, pack in traj["spacecraft"].items():
        hours = decode(pack)["hours"]
        ninc = sum(1 for j in range(1, len(hours)) if hours[j] <= hours[j - 1])
        if ninc:
            print(f"  PACK {mid:12} {ninc} non-increasing hour keys")
        pts = unpack(pack)
        ts = turns(pts, moon_pts)
        if not ts:
            continue
        bad = [t for t in ts if t["deg"] >= max_deg]
        worst = max(ts, key=lambda t: t["deg"])
        worst_raw = max(worst_raw, worst["deg"])
        non = [t for t in bad if not t["flyby"]]
        n_raw_bad += len(non)
        n_raw_flyby += sum(1 for t in bad if t["flyby"])
        if bad:
            src = (traj.get("sources") or {}).get(mid, "")
            print(f"  RAW {mid:12} max={worst['deg']:.1f}°  >=thresh {len(bad)} (non-flyby {len(non)})  {src}")
            for t in sorted(bad, key=lambda x: -x["deg"])[:5]:
                tag = "flyby" if t["flyby"] else "SHARP"
                print(f"      {t['deg']:5.1f}° {tag}  {mjd_iso(t['mjd'])}  r={t['r']:.0f} km")
    print(f"Raw: worst {worst_raw:.1f}°  non-flyby>={max_deg}°: {n_raw_bad}  flyby>={max_deg}°: {n_raw_flyby}")

    # Rendered curve: centripetal Catmull-Rom through the samples (as the page
    # draws it), walked at ~1.5 px display-scale arc steps.
    moon_lookup = (lambda t: interp_moon(moon_pts, t)) if moon_pts else None
    worst_nf = 0.0
    tot_unphys = [0, 0]
    n_bad = 0
    n_fly = 0
    for mid, pack in traj["spacecraft"].items():
        pts = unpack(pack)
        ts = display_turns(catmull_dense(pts, 8), moon_lookup)
        nf = [t for t in ts if not t["flyby"]]
        if not nf:
            continue
        w = max(nf, key=lambda t: t["deg"])
        worst_nf = max(worst_nf, w["deg"])
        bad = [t for t in nf if t["deg"] >= max_deg]
        n_bad += len(bad)
        n_unphys_bad = sum(1 for t in bad if t["accel_ratio"] > 2.0)
        unphys = [t for t in nf if t["deg"] >= 8.0 and t["accel_ratio"] > 2.0]
        tot_unphys[0] += len(unphys)
        tot_unphys[1] += n_unphys_bad
        n_fly += sum(1 for t in ts if t["flyby"] and t["deg"] >= max_deg)
        flag = "  <-- SHARP" if bad else ""
        print(f"  RENDER {mid:12} worst non-flyby {w['deg']:5.1f}° at {mjd_iso(w['mjd'])} r={w['r']:.0f} km{flag}")
        for t in sorted(bad, key=lambda x: -x["deg"])[:3]:
            kind = "unphysical" if t["accel_ratio"] > 2.0 else f"physical turnaround, {t['speed']:.0f} km/day"
            print(f"      {t['deg']:5.1f}°  {mjd_iso(t['mjd'])}  r={t['r']:.0f} km  needs {t['accel_ratio']:.2f}x available accel ({kind})")
        if unphys:
            w2 = max(unphys, key=lambda t: t["accel_ratio"])
            print(f"      unphysical (>=8°, >2x accel): {len(unphys)}; worst {w2['deg']:.1f}° {w2['accel_ratio']:.1f}x at {mjd_iso(w2['mjd'])}")
    print(f"Rendered: worst non-flyby {worst_nf:.1f}°  non-flyby>={max_deg}°: {n_bad} (of which unphysical: {tot_unphys[1]})  flyby>={max_deg}°: {n_fly}")
    print(f"Rendered: unphysical turns >=8° needing >2x the available acceleration: {tot_unphys[0]}")
    return 1 if n_bad else 0


if __name__ == "__main__":
    sys.exit(main())
