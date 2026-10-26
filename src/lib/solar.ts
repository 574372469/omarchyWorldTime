// Solar and globe math, ported from Omarchy's Elsewhen panel
// (shell/plugins/panels/elsewhen/GlobeModel.js and Sun.js, MIT, © DHH).

const DEG = Math.PI / 180;

/** Earth's obliquity — also the hero globe's lean. */
export const AXIAL_TILT = 23.44;

export interface Point {
  x: number;
  y: number;
  visible: boolean;
  cosc: number;
}

/** Orthographic projection onto a disc of radius r seen from over (viewLat, spin). */
export function project(
  lat: number,
  lon: number,
  spin: number,
  viewLat: number,
  r: number,
): Point {
  const phi = lat * DEG;
  const lam = (lon - spin) * DEG;
  const p0 = viewLat * DEG;
  const cosc =
    Math.sin(p0) * Math.sin(phi) + Math.cos(p0) * Math.cos(phi) * Math.cos(lam);
  return {
    x: r * Math.cos(phi) * Math.sin(lam),
    y: -r * (Math.cos(p0) * Math.sin(phi) - Math.sin(p0) * Math.cos(phi) * Math.cos(lam)),
    visible: cosc > 0,
    cosc,
  };
}

export interface SubPoint {
  lat: number;
  lon: number;
}

/** The point with the sun directly overhead, good to a fraction of a degree. */
export function subsolarPoint(ms: number): SubPoint {
  const d = new Date(ms);
  const jd = ms / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (AXIAL_TILT - 0.0000004 * n) * DEG;

  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda)) / DEG;

  const alpha = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / DEG;
  const eot = ((L - alpha + 540) % 360) - 180;
  const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  let lon = -15 * (utcHours - 12) - eot;
  lon = ((lon + 540) % 360) - 180;

  return { lat: decl, lon };
}

export function solarElevation(lat: number, lon: number, sub: SubPoint): number {
  const cosz =
    Math.sin(lat * DEG) * Math.sin(sub.lat * DEG) +
    Math.cos(lat * DEG) * Math.cos(sub.lat * DEG) * Math.cos((lon - sub.lon) * DEG);
  return Math.asin(Math.max(-1, Math.min(1, cosz))) / DEG;
}

/** -0.833 allows for refraction and the sun's disc, as sunrise tables do. */
export function isDaylight(lat: number, lon: number, sub: SubPoint): boolean {
  return solarElevation(lat, lon, sub) > -0.833;
}

type Vec3 = [number, number, number];

function cross(u: Vec3, v: Vec3): Vec3 {
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}

function norm(v: Vec3): Vec3 {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

/** The great circle 90 degrees from the subsolar point: the day/night line. */
export function terminator(sub: SubPoint, steps = 180): [number, number][] {
  const slat = sub.lat * DEG;
  const slon = sub.lon * DEG;
  const s: Vec3 = [Math.cos(slat) * Math.cos(slon), Math.cos(slat) * Math.sin(slon), Math.sin(slat)];
  const up: Vec3 = Math.abs(s[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const a = norm(cross(up, s));
  const b = norm(cross(s, a));
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const v: Vec3 = [
      a[0] * Math.cos(t) + b[0] * Math.sin(t),
      a[1] * Math.cos(t) + b[1] * Math.sin(t),
      a[2] * Math.cos(t) + b[2] * Math.sin(t),
    ];
    out.push([Math.asin(v[2]) / DEG, Math.atan2(v[1], v[0]) / DEG]);
  }
  return out;
}

// ---- moon

const SYNODIC_MONTH = 29.530588853;
const KNOWN_NEW_MOON_JD = 2451550.1;

/** Position through the lunation: 0 new, 0.25 first quarter, 0.5 full. */
export function moonPhase(ms: number): number {
  const jd = ms / 86400000 + 2440587.5;
  const p = ((jd - KNOWN_NEW_MOON_JD) / SYNODIC_MONTH) % 1;
  return p < 0 ? p + 1 : p;
}

/** The lit part of the moon on a disc of radius r at the origin. */
export function moonLitOutline(
  phase: number,
  r: number,
  steps = 24,
): { x: number; y: number }[] {
  const theta = 2 * Math.PI * Number(phase);
  const squash = Math.cos(theta);
  const side = Number(phase) > 0.5 ? -1 : 1;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (Math.PI * i) / steps;
    out.push({ x: side * r * Math.sin(t), y: -r * Math.cos(t) });
  }
  for (let i = steps; i >= 0; i--) {
    const t = (Math.PI * i) / steps;
    out.push({ x: side * r * squash * Math.sin(t), y: -r * Math.cos(t) });
  }
  return out;
}

// ---- clipping to the disc

function limbCrossing(
  a: [number, number],
  b: [number, number],
  spin: number,
  viewLat: number,
  r: number,
): Point | null {
  if (Math.abs(b[1] - a[1]) > 180) return null;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 8; i++) {
    const m = (lo + hi) / 2;
    const p = project(a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m, spin, viewLat, r);
    if (p.visible) lo = m;
    else hi = m;
  }
  return project(a[0] + (b[0] - a[0]) * lo, a[1] + (b[1] - a[1]) * lo, spin, viewLat, r);
}

/** The near-side runs of a polyline, each ending exactly on the horizon. */
export function visibleSegments(
  pts: [number, number][],
  spin: number,
  viewLat: number,
  r: number,
): Point[][] {
  const out: Point[][] = [];
  let run: Point[] = [];
  let prev: [number, number] | null = null;
  let prevVis = false;
  const flush = () => {
    if (run.length > 1) out.push(run);
    run = [];
  };
  for (let i = 0; i < pts.length; i++) {
    const p = project(pts[i][0], pts[i][1], spin, viewLat, r);
    if (p.visible) {
      if (run.length === 0 && prev !== null && !prevVis) {
        const enter = limbCrossing(pts[i], prev, spin, viewLat, r);
        if (enter) run.push(enter);
      }
      run.push(p);
    } else {
      if (run.length > 0 && prev !== null) {
        const exit = limbCrossing(prev, pts[i], spin, viewLat, r);
        if (exit) run.push(exit);
      }
      flush();
    }
    prev = pts[i];
    prevVis = p.visible;
  }
  flush();
  return out;
}

/** A flat [lon, lat, ...] ring clipped to the visible hemisphere as one polygon. */
export function clipRingToDisc(
  ring: number[],
  spin: number,
  viewLat: number,
  r: number,
): { x: number; y: number }[] {
  const pts: [number, number][] = [];
  for (let k = 0; k < ring.length; k += 2) pts.push([ring[k + 1], ring[k]]);
  const out: { p: Point; limb: boolean }[] = [];
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i];
    const B = pts[(i + 1) % pts.length];
    const pa = project(A[0], A[1], spin, viewLat, r);
    const pb = project(B[0], B[1], spin, viewLat, r);
    if (pa.visible && pb.visible) out.push({ p: pb, limb: false });
    else if (pa.visible) {
      const ex = limbCrossing(A, B, spin, viewLat, r);
      if (ex) out.push({ p: ex, limb: true });
    } else if (pb.visible) {
      const en = limbCrossing(B, A, spin, viewLat, r);
      if (en) out.push({ p: en, limb: true });
      out.push({ p: pb, limb: false });
    }
  }
  if (out.length < 3) return [];

  const res: { x: number; y: number }[] = [];
  for (let j = 0; j < out.length; j++) {
    res.push(out[j].p);
    const nx = out[(j + 1) % out.length];
    if (!out[j].limb || !nx.limb) continue;
    const a0 = Math.atan2(out[j].p.y, out[j].p.x);
    const a1 = Math.atan2(nx.p.y, nx.p.x);
    let d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const steps = Math.max(1, Math.round(Math.abs(d) / 0.15));
    for (let t = 1; t < steps; t++) {
      const a = a0 + (d * t) / steps;
      res.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }
  }
  return res;
}

export interface LabelBox {
  index: number;
  box: { x: number; y: number; w: number; h: number };
}

export interface LabelCandidate {
  index: number;
  name: string;
  x: number;
  y: number;
  rank: number;
  cosc: number;
}

/** Greedy label placement by rank, then nearest the disc center. */
export function layoutLabels(
  candidates: LabelCandidate[],
  charWidth: number,
  lineHeight: number,
  limit: number,
  maxX: number,
  gap = 6,
): LabelBox[] {
  const placed: LabelBox[] = [];
  const sorted = candidates.slice().sort((p, q) => {
    if (p.rank !== q.rank) return p.rank - q.rank;
    return q.cosc - p.cosc;
  });
  for (const c of sorted) {
    const w = c.name.length * charWidth;
    let x = c.x + gap;
    if (x + w > maxX) x = c.x - gap - w;
    const box = { x, y: c.y - lineHeight / 2, w, h: lineHeight };
    let clash = false;
    for (const o of placed) {
      const b = o.box;
      if (box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    placed.push({ index: c.index, box });
    if (limit && placed.length >= limit) break;
  }
  return placed;
}

/** Keep points, in priority order, that clear every kept point by minDist. */
export function declutter<T extends { x: number; y: number; keep?: boolean }>(
  points: T[],
  minDist: number,
): T[] {
  const kept: T[] = [];
  for (const p of points) {
    if (p.keep) {
      kept.push(p);
      continue;
    }
    let clash = false;
    for (const k of kept) {
      if (Math.hypot(p.x - k.x, p.y - k.y) < minDist) {
        clash = true;
        break;
      }
    }
    if (!clash) kept.push(p);
  }
  return kept;
}

/** Signed degrees in (-180, 180] to turn from one longitude to another. */
export function shortestTurn(from: number, to: number): number {
  const d = (((to - from) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

/** Every `keepEvery`th vertex of a flat [lon, lat, ...] ring. */
export function decimateRing(ring: number[], keepEvery = 2, minPoints = 8): number[] {
  const n = ring.length / 2;
  if (keepEvery < 2 || n <= minPoints) return ring;
  const out: number[] = [];
  for (let i = 0; i < n; i += keepEvery) out.push(ring[i * 2], ring[i * 2 + 1]);
  const lastI = (n - 1) * 2;
  if (out[out.length - 2] !== ring[lastI] || out[out.length - 1] !== ring[lastI + 1])
    out.push(ring[lastI], ring[lastI + 1]);
  return out;
}

// ---- sunrise and sunset (Sun.js)

const HORIZON = -0.833;

function wrap180(deg: number): number {
  return ((deg + 540) % 360) - 180;
}

function solarNoonMs(lon: number, nearMs: number): number {
  let t = nearMs;
  for (let i = 0; i < 3; i++) {
    const sub = subsolarPoint(t);
    t += (wrap180(sub.lon - lon) / 15) * 3600000;
  }
  return t;
}

export function localMidnightMs(ms: number, offsetMinutes: number): number {
  const local = ms + offsetMinutes * 60000;
  return Math.floor(local / 86400000) * 86400000 - offsetMinutes * 60000;
}

export type SunKind = "normal" | "midnightSun" | "polarNight";

export interface SunTimes {
  kind: SunKind;
  noonMs: number;
  riseMs: number | null;
  setMs: number | null;
  riseMinutes: number | null;
  setMinutes: number | null;
  dayMinutes: number;
}

/** Sunrise and sunset for the local day containing `ms`, in minutes from local midnight. */
export function sunTimes(
  lat: number,
  lon: number,
  ms: number,
  offsetMinutes: number,
): SunTimes {
  const midnight = localMidnightMs(ms, offsetMinutes);
  const noon = solarNoonMs(lon, midnight + 43200000);
  const dec = subsolarPoint(noon).lat;

  const cosH =
    (Math.sin(HORIZON * DEG) - Math.sin(lat * DEG) * Math.sin(dec * DEG)) /
    (Math.cos(lat * DEG) * Math.cos(dec * DEG));

  if (cosH <= -1)
    return {
      kind: "midnightSun",
      noonMs: noon,
      riseMs: null,
      setMs: null,
      riseMinutes: null,
      setMinutes: null,
      dayMinutes: 1440,
    };
  if (cosH >= 1)
    return {
      kind: "polarNight",
      noonMs: noon,
      riseMs: null,
      setMs: null,
      riseMinutes: null,
      setMinutes: null,
      dayMinutes: 0,
    };

  const halfDayMs = (Math.acos(cosH) / DEG / 15) * 3600000;
  const riseMs = noon - halfDayMs;
  const setMs = noon + halfDayMs;

  return {
    kind: "normal",
    noonMs: noon,
    riseMs,
    setMs,
    riseMinutes: (riseMs - midnight) / 60000,
    setMinutes: (setMs - midnight) / 60000,
    dayMinutes: (setMs - riseMs) / 60000,
  };
}

/** The lit parts of a 24-hour strip as 0..1 spans, drawn a day either side. */
export function litSpans(times: SunTimes | null): { x0: number; x1: number }[] {
  if (!times) return [];
  if (times.kind === "polarNight") return [];
  if (times.kind === "midnightSun") return [{ x0: 0, x1: 1 }];
  const out: { x0: number; x1: number }[] = [];
  for (let shift = -1440; shift <= 1440; shift += 1440) {
    const a = Math.max(0, Math.min(1440, (times.riseMinutes ?? 0) + shift));
    const b = Math.max(0, Math.min(1440, (times.setMinutes ?? 0) + shift));
    if (b > a) out.push({ x0: a / 1440, x1: b / 1440 });
  }
  return out;
}

export function eventMark(minutes: number | null): number | null {
  if (minutes === null || minutes === undefined) return null;
  if (minutes < 0 || minutes > 1440) return null;
  return minutes / 1440;
}

/** Daylight at `minutes`, read from the same three days litSpans draws. */
export function litAt(times: SunTimes | null, minutes: number): boolean {
  if (!times) return false;
  if (times.kind === "midnightSun") return true;
  if (times.kind === "polarNight") return false;
  for (let shift = -1440; shift <= 1440; shift += 1440)
    if (
      minutes >= (times.riseMinutes ?? 0) + shift &&
      minutes < (times.setMinutes ?? 0) + shift
    )
      return true;
  return false;
}
