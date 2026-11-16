"""Smooth, display-scale-aware resampling for Lagrange trajectories.

Points are (mjd, x, y, z) in the Earth-centred Sun–Earth rotating frame (km).
Velocities are km/day in the same frame.
"""
from __future__ import annotations

import bisect
import math

FLYBY_KM = 50000.0


def _norm(v):
    return math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])


def _angle(u, v):
    nu, nv = _norm(u), _norm(v)
    if nu < 1e-9 or nv < 1e-9:
        return 0.0
    d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (nu * nv)
    return math.degrees(math.acos(max(-1.0, min(1.0, d))))


def display_step(p, moon):
    """Arc-length step (km) of roughly 1.5 screen pixels at the view a viewer
    would use for this part of space."""
    re = _norm(p[1:4] if len(p) == 4 else p)
    base = re
    if moon is not None:
        q = p[1:4] if len(p) == 4 else p
        rm = math.sqrt((q[0] - moon[0]) ** 2 + (q[1] - moon[1]) ** 2 + (q[2] - moon[2]) ** 2)
        base = min(re, 2.5 * rm)
    return max(60.0, min(2500.0, 0.0015 * base))


def is_flyby(p, moon):
    re = _norm(p[1:4])
    if re < FLYBY_KM:
        return True
    if moon is not None:
        rm = math.sqrt((p[1] - moon[0]) ** 2 + (p[2] - moon[1]) ** 2 + (p[3] - moon[2]) ** 2)
        if rm < FLYBY_KM:
            return True
    return False


def display_turns(pts, moon_lookup=None):
    """Walk the polyline at display-scale arc steps; return the turning angle at
    each step as dicts {mjd, deg, flyby, r}."""
    if len(pts) < 3:
        return []
    samples = [pts[0]]
    acc = 0.0
    step = display_step(pts[0], moon_lookup(pts[0][0]) if moon_lookup else None)
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        seg = math.sqrt((b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2 + (b[3] - a[3]) ** 2)
        pos = 0.0
        while acc + (seg - pos) >= step:
            need = step - acc
            pos += need
            t = pos / seg if seg else 0.0
            q = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2]), a[3] + t * (b[3] - a[3]))
            samples.append(q)
            acc = 0.0
            step = display_step(q, moon_lookup(q[0]) if moon_lookup else None)
        acc += seg - pos
    out = []
    for i in range(1, len(samples) - 1):
        a, b, c = samples[i - 1], samples[i], samples[i + 1]
        u = (b[1] - a[1], b[2] - a[2], b[3] - a[3])
        v = (c[1] - b[1], c[2] - b[2], c[3] - b[3])
        mo = moon_lookup(b[0]) if moon_lookup else None
        deg = _angle(u, v)
        arc = 0.5 * (_norm(u) + _norm(v))
        dt = c[0] - a[0]
        speed = (_norm(u) + _norm(v)) / dt if dt > 1e-9 else 1e12
        need = (math.radians(deg) / arc if arc > 0 else 0.0) * speed * speed
        out.append({"mjd": b[0], "deg": deg, "flyby": is_flyby(b, mo), "r": _norm(b[1:4]),
                    "speed": speed, "accel_ratio": need / accel_bound(b, mo, speed)})
    return out


# Gravitational parameters in km^3/day^2 and Earth's orbital rate in rad/day.
GM_E = 398600.4418 * 86400.0 ** 2
GM_M = 4902.8 * 86400.0 ** 2
OMEGA = 2 * math.pi / 365.25636
SE_L_X = 1.4915e6


def accel_bound(p, moon, speed):
    """Generous upper bound (km/day^2) on the acceleration a spacecraft can feel
    in the Earth-centred Sun–Earth rotating frame: near the Sun–Earth points the
    pulls nearly cancel and what remains is the Hill/tidal term plus Coriolis."""
    x, y, z = p[1], p[2], p[3]
    re = math.sqrt(x * x + y * y + z * z)
    a = 2.0 * OMEGA * speed
    if moon is not None:
        rm = math.sqrt((x - moon[0]) ** 2 + (y - moon[1]) ** 2 + (z - moon[2]) ** 2)
        a += GM_M / max(rm, 1737.0) ** 2
        # Earth–Moon system: following the Moon means ~its centripetal pull.
        if rm < 250000:
            a += GM_E / max(re, 6371.0) ** 2
    if re > 1.0e6:
        dl = min(math.sqrt((x - SE_L_X) ** 2 + y * y + z * z), math.sqrt((x + SE_L_X) ** 2 + y * y + z * z))
        a += 4.5 * OMEGA ** 2 * max(dl, 50000.0)
    else:
        a += GM_E / max(re, 6371.0) ** 2 + 4.5 * OMEGA ** 2 * re
    return a


def unphysical(t, max_deg=12.0, ratio=2.0):
    return t["deg"] >= max_deg and not t["flyby"] and t["accel_ratio"] > ratio


def dedupe(points, min_dt=1e-4):
    pts = sorted(points, key=lambda p: p[0])
    out = []
    for p in pts:
        if out and p[0] - out[-1][0] < min_dt:
            continue
        out.append(tuple(p[:4]))
    return out


def tangents(points, states=None):
    n = len(points)
    out = []
    for i, p in enumerate(points):
        st = states.get(round(p[0], 6)) if states else None
        if st and abs(st[0] - p[1]) + abs(st[1] - p[2]) + abs(st[2] - p[3]) < 5:
            # Guard against the odd corrupt ephemeris velocity: it must agree
            # with the chords to its neighbours to within a few times.
            seg = []
            for j in (i - 1, i + 1):
                if 0 <= j < n and abs(points[j][0] - p[0]) > 1e-9:
                    q = points[j]
                    dt = abs(q[0] - p[0])
                    seg.append(math.sqrt((q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2 + (q[3] - p[3]) ** 2) / dt)
            sp = _norm(st[3:6])
            if not seg or (sp <= 3.0 * max(seg) + 2000.0 and sp >= min(seg) / 3.0 - 2000.0):
                out.append(tuple(st[3:6]))
                continue
        if n < 2:
            out.append((0.0, 0.0, 0.0))
        elif i == 0 or i == n - 1:
            a, b = (points[0], points[1]) if i == 0 else (points[-2], points[-1])
            dt = b[0] - a[0]
            out.append(((b[1] - a[1]) / dt, (b[2] - a[2]) / dt, (b[3] - a[3]) / dt))
        else:
            a, c = points[i - 1], points[i + 1]
            d1, d2 = p[0] - a[0], c[0] - p[0]
            v = []
            for k in (1, 2, 3):
                s1 = (p[k] - a[k]) / d1
                s2 = (c[k] - p[k]) / d2
                v.append((s1 * d2 + s2 * d1) / (d1 + d2))
            out.append(tuple(v))
    return out


def herm(p0, v0, p1, v1, t0, t1, t):
    h = t1 - t0
    u = (t - t0) / h if h else 0.0
    u2, u3 = u * u, u * u * u
    h00, h10, h01, h11 = 2 * u3 - 3 * u2 + 1, u3 - 2 * u2 + u, -2 * u3 + 3 * u2, u3 - u2
    d00, d10, d01, d11 = 6 * u2 - 6 * u, 3 * u2 - 4 * u + 1, -6 * u2 + 6 * u, 3 * u2 - 2 * u
    pos = tuple(h00 * p0[k] + h10 * h * v0[k] + h01 * p1[k] + h11 * h * v1[k] for k in range(3))
    vel = tuple((d00 * p0[k] + d10 * h * v0[k] + d01 * p1[k] + d11 * h * v1[k]) / h if h else v0[k] for k in range(3))
    return pos, vel


class Curve:
    def __init__(self, points, vels):
        self.p = points
        self.v = vels
        self.t = [p[0] for p in points]

    def at(self, t):
        import bisect
        ts = self.t
        if t <= ts[0]:
            return self.p[0][1:4], self.v[0]
        if t >= ts[-1]:
            return self.p[-1][1:4], self.v[-1]
        i = bisect.bisect_right(ts, t) - 1
        return herm(self.p[i][1:4], self.v[i], self.p[i + 1][1:4], self.v[i + 1], ts[i], ts[i + 1], t)

    def dense(self, max_deg=2.0, max_sub=64):
        out = []
        for i in range(len(self.p) - 1):
            a, b = self.p[i], self.p[i + 1]
            out.append(a)
            chord = (b[1] - a[1], b[2] - a[2], b[3] - a[3])
            ang = max(_angle(self.v[i], chord), _angle(chord, self.v[i + 1]))
            k = min(max_sub, max(1, int(math.ceil(ang / max_deg))))
            for j in range(1, k):
                t = a[0] + (b[0] - a[0]) * j / k
                pos, _ = herm(a[1:4], self.v[i], b[1:4], self.v[i + 1], a[0], b[0], t)
                out.append((t,) + pos)
        out.append(self.p[-1])
        return out


def round_corners(points, vels, moon_lookup, max_deg=8.0, log=print, trusted=None):
    """Replace display-scale corners (modelled joins, ephemeris arc seams) with
    position-and-velocity-continuous Hermite bridges. Flybys are left alone."""
    for _round in range(4):
        curve = Curve(points, vels)
        dense = curve.dense()
        dts = [q[0] for q in dense]
        bad = [t for t in display_turns(dense, moon_lookup) if unphysical(t, max_deg)]
        if not bad:
            return points, vels
        # cluster corner times
        clusters = []
        for b in bad:
            if clusters and b["mjd"] - clusters[-1][1] < 1.0:
                clusters[-1][1] = b["mjd"]
            else:
                clusters.append([b["mjd"], b["mjd"]])
        t_lo, t_hi = points[0][0], points[-1][0]
        bridges = []
        for c0, c1 in clusters:
            done = False
            # Inside real ephemeris (Horizons positions and velocities) only
            # seams get a short bridge; a long bridge would erase real motion.
            wmax = 3 if (trusted and trusted(c0) and trusted(c1)) else 24
            for W in (0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24):
                if W > wmax:
                    break
                a, b = max(t_lo, c0 - W), min(t_hi, c1 + W)
                if b - a < 0.2:
                    continue
                pa, va = curve.at(a)
                pb, vb = curve.at(b)
                n = max(8, int((b - a) / 0.1))
                n = min(n, 400)
                br = []
                for j in range(n + 1):
                    t = a + (b - a) * j / n
                    pos, vel = herm(pa, va, pb, vb, a, b, t)
                    br.append(((t,) + pos, vel))
                i0 = bisect.bisect_left(dts, a - 3 * W)
                i1 = bisect.bisect_left(dts, a)
                i2 = bisect.bisect_right(dts, b)
                i3 = bisect.bisect_right(dts, b + 3 * W)
                seg = dense[i0:i1] + [q for q, _ in br] + dense[i2:i3]
                if any(is_flyby(q, moon_lookup(q[0]) if moon_lookup else None) for q, _ in br):
                    break
                if not any(unphysical(t, max_deg) for t in display_turns(seg, moon_lookup)):
                    bridges.append((a, b, br, W))
                    done = True
                    break
            if not done:
                log(f"    corner at mjd {c0:.1f} not rounded")
        if not bridges:
            return points, vels
        log(f"    rounded {len(bridges)} corner(s): " + ", ".join(f"{a:.1f}±{W}d" for a, b, br, W in bridges[:6]))
        npts, nvel = [], []
        bi = 0
        bridges.sort(key=lambda x: x[0])
        merged = []
        for br in bridges:
            if merged and br[0] <= merged[-1][1]:
                continue  # overlapping; next round handles it
            merged.append(br)
        i = 0
        for a, b, br, W in merged:
            while i < len(points) and points[i][0] < a:
                npts.append(points[i]); nvel.append(vels[i]); i += 1
            for q, v in br:
                npts.append(q); nvel.append(v)
            while i < len(points) and points[i][0] <= b:
                i += 1
        while i < len(points):
            npts.append(points[i]); nvel.append(vels[i]); i += 1
        points, vels = npts, nvel
    return points, vels


def simplify(dense, moon_lookup, max_dt=4.0, tol_frac=0.5):
    """Greedy chord simplification: drop samples while every skipped one stays
    within ~1 px (a third of a display step) of the chord."""
    n = len(dense)
    if n < 3:
        return dense
    tol2 = []
    for p in dense:
        t = tol_frac * display_step(p, moon_lookup(p[0]) if moon_lookup else None)
        tol2.append(t * t)

    def ok(i, j):
        if dense[j][0] - dense[i][0] > max_dt:
            return False
        a, b = dense[i], dense[j]
        abx, aby, abz = b[1] - a[1], b[2] - a[2], b[3] - a[3]
        L2 = abx * abx + aby * aby + abz * abz
        for k in range(i + 1, j):
            q = dense[k]
            ax, ay, az = q[1] - a[1], q[2] - a[2], q[3] - a[3]
            t = (ax * abx + ay * aby + az * abz) / L2 if L2 > 0 else 0.0
            t = 0.0 if t < 0 else (1.0 if t > 1 else t)
            dx, dy, dz = ax - t * abx, ay - t * aby, az - t * abz
            if dx * dx + dy * dy + dz * dz > tol2[k]:
                return False
        return True

    out = [dense[0]]
    i = 0
    while i < n - 1:
        good, step = i + 1, 1
        bad = None
        while True:
            j = i + step
            if j >= n:
                j = n - 1
                if j > good and ok(i, j):
                    good = j
                else:
                    bad = j if j > good else None
                break
            if ok(i, j):
                good = j
                step *= 2
            else:
                bad = j
                break
        if bad is not None:
            lo, hi = good, bad
            while hi - lo > 1:
                mid = (lo + hi) // 2
                if ok(i, mid):
                    lo = mid
                else:
                    hi = mid
            good = lo
        out.append(dense[good])
        i = good
    return out


def drop_outliers(pts, states, moon_lookup, log=print):
    """Remove isolated samples that disagree with a Hermite prediction from
    both neighbours (ephemeris arc seams), and distrust velocities that point
    somewhere the neighbours do not agree with. Close passes are exempt."""
    states = dict(states or {})
    removed = 0
    badv = 0
    for _ in range(4):
        vels = tangents(pts, states)
        keep = [True] * len(pts)
        for i in range(1, len(pts) - 1):
            p = pts[i]
            if is_flyby(p, moon_lookup(p[0]) if moon_lookup else None):
                continue
            # Best of several brackets, so a pair of bad neighbours cannot
            # hide a bad sample or condemn a good one.
            best = None
            for jl in (1, 2, 3):
                for jr in (1, 2, 3):
                    il, ir = i - jl, i + jr
                    if il < 0 or ir >= len(pts) or not keep[il]:
                        continue
                    a, c = pts[il], pts[ir]
                    if c[0] - a[0] > 8.0:
                        continue
                    pred, pv = herm(a[1:4], vels[il], c[1:4], vels[ir], a[0], c[0], p[0])
                    chord = math.sqrt((c[1] - a[1]) ** 2 + (c[2] - a[2]) ** 2 + (c[3] - a[3]) ** 2)
                    dev = math.sqrt((p[1] - pred[0]) ** 2 + (p[2] - pred[1]) ** 2 + (p[3] - pred[2]) ** 2)
                    score = dev / (0.06 * chord + 400.0)
                    if best is None or score < best[0]:
                        best = (score, pv)
            if best is None:
                continue
            if best[0] > 1.0:
                keep[i] = False
                continue
            pv = best[1]
            k = round(p[0], 6)
            if k in states and _angle(states[k][3:6], pv) > 35.0 and _norm(pv) > 500.0:
                del states[k]
                badv += 1
        n0 = len(pts)
        pts = [q for q, ok in zip(pts, keep) if ok]
        removed += n0 - len(pts)
        if n0 == len(pts):
            break
    if removed or badv:
        log(f"    dropped {removed} inconsistent sample(s), {badv} suspect velocity(ies)")
    return pts, states


def smooth_track(points, states, moon_lookup, log=print):
    pts = dedupe(points)
    if len(pts) < 4:
        return pts
    pts, states = drop_outliers(pts, states, moon_lookup, log=log)
    vels = tangents(pts, states)
    st_t = sorted(k for k in (states or {}))

    def trusted(t):
        if not st_t:
            return False
        i = bisect.bisect_left(st_t, t)
        lo = st_t[i - 1] if i > 0 else None
        hi = st_t[i] if i < len(st_t) else None
        return lo is not None and hi is not None and t - lo < 1.6 and hi - t < 1.6

    pts, vels = round_corners(pts, vels, moon_lookup, log=log, trusted=trusted)
    dense = Curve(pts, vels).dense()
    out = simplify(dense, moon_lookup)
    return out


def catmull_dense(pts, sub=8):
    """Centripetal Catmull–Rom densification (matches the page renderer)."""
    n = len(pts)
    if n < 3:
        return list(pts)
    out = []
    for i in range(n - 1):
        p0 = pts[max(0, i - 1)]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[min(n - 1, i + 2)]
        out.append(p1)
        for j in range(1, sub):
            u = j / sub
            out.append((p1[0] + u * (p2[0] - p1[0]),) + cr_centripetal(p0[1:4], p1[1:4], p2[1:4], p3[1:4], u))
    out.append(pts[-1])
    return out


def cr_centripetal(p0, p1, p2, p3, u):
    def d(a, b):
        return max(1e-6, math.sqrt(math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)))
    d01, d12, d23 = d(p0, p1), d(p1, p2), d(p2, p3)
    res = []
    for k in range(3):
        m1 = (p1[k] - p0[k]) / d01 - (p2[k] - p0[k]) / (d01 + d12) + (p2[k] - p1[k]) / d12
        m2 = (p2[k] - p1[k]) / d12 - (p3[k] - p1[k]) / (d12 + d23) + (p3[k] - p2[k]) / d23
        m1 *= d12; m2 *= d12
        a = 2 * p1[k] - 2 * p2[k] + m1 + m2
        b = -3 * p1[k] + 3 * p2[k] - 2 * m1 - m2
        res.append(a * u ** 3 + b * u ** 2 + m1 * u + p1[k])
    return tuple(res)
