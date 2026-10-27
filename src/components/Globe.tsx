import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alpha, mix } from "../lib/color";
import { localizedCity } from "../lib/cityNames";
import { t, type Lang } from "../lib/i18n";
import world from "../data/world.json";
import {
  AXIAL_TILT,
  clipRingToDisc,
  decimateRing,
  declutter,
  isDaylight,
  layoutLabels,
  moonPhase,
  project,
  shortestTurn,
  subsolarPoint,
  terminator,
  visibleSegments,
} from "../lib/solar";
import { CITIES, canonicalZone, formatTime, utcOffsetLabel, zoneOffsetMinutes, zoneParts, type City } from "../lib/time";

export interface GlobeCity {
  label: string;
  /** The name drawn on the globe and in the footer, in the panel's language. */
  name: string;
  zone: string;
  lat: number;
  lon: number;
  rank: number;
  tracked: boolean;
  home: boolean;
}

interface Props {
  now: number;
  tracked: City[];
  homeZone: string;
  hour24: boolean;
  bg: string;
  fg: string;
  accent: string;
  daylightMarker: string;
  focusLon: number;
  focusLat: number;
  focusShown: boolean;
  /** 0 is the list, 1 the globe filling the stage. */
  zoom: number;
  /** Skip painting while the globe is behind the list. */
  active: boolean;
  reducedMotion: boolean;
  lang: Lang;
  onSelect: (city: GlobeCity | null) => void;
  onExit: () => void;
}

const rings = world as number[][];
const coarse = rings.map((r) => decimateRing(r, 2, 8));

const TRACKED_COLOR = "#E5C736";

export function Globe({
  now,
  tracked,
  homeZone,
  hour24,
  bg,
  fg,
  accent,
  focusLon,
  focusLat,
  focusShown,
  zoom,
  active,
  reducedMotion,
  lang,
  onSelect,
  onExit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [spin, setSpin] = useState(focusLon);
  const [viewLat, setViewLat] = useState(20);
  const [dragging, setDragging] = useState(false);
  const [moving, setMoving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const velocity = useRef(0);
  const drag = useRef({ x: 0, y: 0, moved: false, id: -1 });
  const flight = useRef<number | null>(null);

  const sub = useMemo(() => subsolarPoint(now), [now]);
  const phase = useMemo(() => moonPhase(now), [now]);

  const trackedZones = useMemo(
    () => new Set(tracked.map((c) => canonicalZone(c.id))),
    [tracked],
  );
  const homeId = useMemo(() => canonicalZone(homeZone), [homeZone]);

  const cities = useMemo<GlobeCity[]>(() => {
    const byKey = new Map<string, GlobeCity>();
    for (const c of CITIES) {
      const id = canonicalZone(c.id);
      const isTracked = trackedZones.has(id);
      const isHome = id === homeId;
      if (!isTracked && !isHome) continue;
      byKey.set(`${c.label}|${c.id}`, {
        label: c.label,
        name: localizedCity(c.id, lang) || c.label,
        zone: c.id,
        lat: c.lat ?? 0,
        lon: c.lon ?? 0,
        rank: c.rank,
        tracked: isTracked,
        home: isHome,
      });
    }
    return [...byKey.values()];
  }, [trackedZones, homeId, lang]);

  // ---- resize
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- turn to the focus city
  const flyTo = useCallback(
    (lat: number, lon: number) => {
      if (flight.current) cancelAnimationFrame(flight.current);
      const fromSpin = spin;
      const fromLat = viewLat;
      const toSpin = fromSpin + shortestTurn(fromSpin, lon);
      const toLat = Math.max(-70, Math.min(70, lat));
      const start = performance.now();
      const dur = reducedMotion ? 0 : 800;
      setMoving(true);
      const step = (t: number) => {
        const k = dur === 0 ? 1 : Math.min(1, (t - start) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        setSpin(fromSpin + (toSpin - fromSpin) * e);
        setViewLat(fromLat + (toLat - fromLat) * e);
        if (k < 1) flight.current = requestAnimationFrame(step);
        else {
          flight.current = null;
          setMoving(false);
        }
      };
      flight.current = requestAnimationFrame(step);
    },
    [spin, viewLat, reducedMotion],
  );

  const focusRef = useRef({ lat: focusLat, lon: focusLon, shown: focusShown });
  useEffect(() => {
    const prev = focusRef.current;
    if (!focusShown) return;
    if (prev.shown === focusShown && prev.lat === focusLat && prev.lon === focusLon) return;
    focusRef.current = { lat: focusLat, lon: focusLon, shown: focusShown };
    flyTo(focusLat, focusLon);
  }, [focusLat, focusLon, focusShown, flyTo]);

  // ---- the throw: spin keeps going after a drag and eases to a stop
  useEffect(() => {
    if (dragging || Math.abs(velocity.current) < 0.01) return;
    let id = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(64, t - last);
      last = t;
      velocity.current *= Math.pow(0.96, dt / 16);
      setSpin((s) => s + velocity.current * (dt / 16));
      if (Math.abs(velocity.current) >= 0.01) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [dragging]);

  // ---- painting
  // The footer and hint live under the disc once the globe has landed, so
  // leave them their band rather than drawing through them.
  const footerBand = 74 * Math.max(0, Math.min(1, (zoom - 0.4) / 0.35));
  const radius = Math.max(1, Math.min(size.w, size.h - footerBand) / 2 - 10);
  const reduced = moving || dragging;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0 || !active) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.translate(size.w / 2, size.h / 2);

    const r = radius;
    const surfaceBase = bg;
    const ink = (a: number) => alpha(fg, a);

    // Ocean disc.
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = mix(surfaceBase, fg, 0.05);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink(0.22);
    ctx.stroke();

    const strokePath = (pts: [number, number][]) => {
      const segs = visibleSegments(pts, spin, viewLat, r);
      for (const seg of segs) {
        if (seg.length < 2) continue;
        ctx.moveTo(seg[0].x, seg[0].y);
        for (let j = 1; j < seg.length; j++) ctx.lineTo(seg[j].x, seg[j].y);
      }
    };

    // Graticule every 30 degrees, or 60 while moving.
    const gStep = reduced ? 60 : 30;
    ctx.beginPath();
    for (let lon = -180; lon < 180; lon += gStep) {
      const pts: [number, number][] = [];
      for (let lat = -90; lat <= 90; lat += 3) pts.push([lat, lon]);
      strokePath(pts);
    }
    for (let lat = -60; lat <= 60; lat += gStep) {
      const pts: [number, number][] = [];
      for (let lon = -180; lon <= 180; lon += 3) pts.push([lat, lon]);
      strokePath(pts);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink(0.1);
    ctx.stroke();

    // Land.
    const useCoarse = reduced && zoom < 0.5;
    const useRings = useCoarse ? coarse : rings;
    const landPolys: { x: number; y: number }[][] = [];
    ctx.beginPath();
    for (const ring of useRings) {
      const poly = clipRingToDisc(ring, spin, viewLat, r);
      if (poly.length < 3) continue;
      landPolys.push(poly);
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let q = 1; q < poly.length; q++) ctx.lineTo(poly[q].x, poly[q].y);
      ctx.closePath();
    }
    ctx.fillStyle = mix(surfaceBase, fg, 0.92);
    ctx.fill();

    // Day/night line.
    ctx.beginPath();
    strokePath(terminator(sub, 180));
    ctx.lineWidth = 1;
    ctx.strokeStyle = alpha(TRACKED_COLOR, 0.55);
    ctx.stroke();

    // Cities.
    const plotted = cities
      .map((c) => {
        const p = project(c.lat, c.lon, spin, viewLat, r);
        return { c, p };
      })
      .filter((x) => x.p.visible)
      .sort((a, b) => {
        if (a.c.home !== b.c.home) return a.c.home ? -1 : 1;
        if (a.c.tracked !== b.c.tracked) return a.c.tracked ? -1 : 1;
        if (a.c.rank !== b.c.rank) return a.c.rank - b.c.rank;
        return b.p.cosc - a.p.cosc;
      });
    const kept = declutter(
      plotted.map((x) => ({ ...x, x: x.p.x, y: x.p.y, keep: x.c.home || x.c.tracked })),
      19,
    );

    const nightMarker = alpha(surfaceBase, 0.92);
    for (const item of kept) {
      const day = isDaylight(item.c.lat, item.c.lon, sub);
      const isSel = item.c.zone === selected;
      ctx.beginPath();
      ctx.arc(item.p.x, item.p.y, isSel ? 3.6 : 2.2, 0, Math.PI * 2);
      ctx.fillStyle = day ? TRACKED_COLOR : nightMarker;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = day ? alpha(surfaceBase, 0.7) : ink(0.85);
      ctx.stroke();
      if (item.c.home) {
        ctx.beginPath();
        ctx.arc(item.p.x, item.p.y, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = alpha(surfaceBase, 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(item.p.x, item.p.y, 6.4, 0, Math.PI * 2);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = alpha(accent, 0.65);
        ctx.stroke();
      } else if (item.c.tracked) {
        ctx.beginPath();
        ctx.arc(item.p.x, item.p.y, 4.6, 0, Math.PI * 2);
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = accent;
        ctx.stroke();
      }
      if (isSel) {
        ctx.beginPath();
        ctx.arc(item.p.x, item.p.y, 7.5, 0, Math.PI * 2);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = day ? TRACKED_COLOR : fg;
        ctx.stroke();
      }
    }

    // Labels: light over sea, dark over land.
    const charW = 10 * 0.62;
    const lineH = 10 + 3;
    const labels = reduced
      ? []
      : layoutLabels(
          kept
            .filter((x) => x.p.cosc >= 0.12)
            .map((x) => ({
              index: kept.indexOf(x),
              name: x.c.name,
              x: x.p.x,
              y: x.p.y,
              rank: x.c.home || x.c.tracked ? 0 : x.c.rank,
              cosc: x.p.cosc,
            })),
          charW,
          lineH,
          14,
          size.w / 2 - 4,
          6,
        );

    // The canvas picks up whatever text font the panel is set in, so a CJK
    // label is drawn in the browser's own CJK face rather than tofu.
    const labelFont = getComputedStyle(canvas).fontFamily || "monospace";
    const paintLabels = (color: string) => {
      ctx.font = `500 10px ${labelFont}`;
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      for (const l of labels) {
        const item = kept[l.index];
        ctx.fillText(item.c.name, l.box.x, l.box.y + l.box.h / 2);
      }
    };
    paintLabels(ink(0.95));

    ctx.save();
    ctx.beginPath();
    for (const poly of landPolys) {
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let q = 1; q < poly.length; q++) ctx.lineTo(poly[q].x, poly[q].y);
      ctx.closePath();
    }
    ctx.clip();
    paintLabels(surfaceBase);
    ctx.restore();

    // Marker for the focused city, drawn last so it sits above the names.
    if (focusShown) {
      const p = project(focusLat, focusLon, spin, viewLat, r);
      if (p.visible) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = alpha(accent, 0.7);
        ctx.stroke();
      }
    }
  }, [
    size,
    radius,
    spin,
    viewLat,
    sub,
    fg,
    bg,
    accent,
    cities,
    selected,
    focusShown,
    focusLat,
    focusLon,
    reduced,
    zoom,
    active,
  ]);

  // ---- pointer
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (flight.current) {
      cancelAnimationFrame(flight.current);
      flight.current = null;
      setMoving(false);
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    velocity.current = 0;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging || drag.current.id !== e.pointerId) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
    setSpin((s) => s - dx * 0.45);
    setViewLat((v) => Math.max(-80, Math.min(80, v + dy * 0.35)));
    velocity.current = -dx * 0.45;
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag.current.id !== e.pointerId) return;
    setDragging(false);
    if (drag.current.moved) return;
    velocity.current = 0;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;

    // Nearest plotted city within reach, else clear.
    let best: GlobeCity | null = null;
    let bestD = 13;
    for (const c of cities) {
      const p = project(c.lat, c.lon, spin, viewLat, radius);
      if (!p.visible) continue;
      const d = Math.hypot(cx - p.x, cy - p.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    setSelected(best ? best.zone : null);
    if (best) flyTo(best.lat, best.lon);
    onSelect(best);
  };

  const selCity = selected ? cities.find((c) => c.zone === selected) ?? null : null;
  const selOffset = selCity ? zoneOffsetMinutes(selCity.zone, now) : 0;
  const selDaylight = selCity ? isDaylight(selCity.lat, selCity.lon, sub) : false;
  const chrome = Math.max(0, Math.min(1, (zoom - 0.4) / 0.35));

  return (
    <div ref={wrapRef} className="globe-wrap" style={{ opacity: Math.min(1, zoom / 0.12) }}>
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        style={{
          width: size.w,
          height: size.h,
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDragging(false)}
      />

      <div className="globe-chrome" style={{ opacity: chrome }}>
        {selCity && (
          <div className="globe-footer">
            <div className="globe-footer-line">
              <span
                className="globe-dot"
                style={{ background: selDaylight ? TRACKED_COLOR : "transparent" }}
              />
              <span className="globe-name">{selCity.name}</span>
              <span className="globe-clock">
                {formatTime(zoneParts(selCity.zone, now), hour24)}
              </span>
              {selCity.home && <span className="globe-badge">{t(lang, "home")}</span>}
              {!selCity.home && selCity.tracked && (
                <span className="globe-badge">{t(lang, "tracked")}</span>
              )}
            </div>
            <div className="globe-footer-line is-dim">
              <span>{selCity.zone}</span>
              <span>{utcOffsetLabel(selOffset)}</span>
            </div>
          </div>
        )}
        {!selCity && (
          <div className="globe-hint">
            <span>{t(lang, "dragToSpin")}</span>
            <span className="globe-hint-sep">·</span>
            <span>{t(lang, "tapCity")}</span>
          </div>
        )}
        <button
          type="button"
          className="globe-exit"
          onClick={onExit}
          aria-label={t(lang, "backToList")}
        >
          <span aria-hidden="true">×</span>
          <span className="globe-exit-label">{t(lang, "listLabel")}</span>
        </button>
        <span className="globe-phase" title={t(lang, "moonPhase")} aria-label={t(lang, "moonPhase")}>
          <MoonBadge phase={phase} color={fg} />
        </span>
      </div>
    </div>
  );
}

function MoonBadge({ phase, color }: { phase: number; color: string }) {
  const r = 5;
  const theta = 2 * Math.PI * phase;
  const squash = Math.cos(theta);
  const side = phase > 0.5 ? -1 : 1;
  const pts: string[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = (Math.PI * i) / 14;
    pts.push(`${r + side * r * Math.sin(t)},${r - r * Math.cos(t)}`);
  }
  for (let i = 14; i >= 0; i--) {
    const t = (Math.PI * i) / 14;
    pts.push(`${r + side * r * squash * Math.sin(t)},${r - r * Math.cos(t)}`);
  }
  return (
    <svg width={r * 2} height={r * 2} viewBox={`0 0 ${r * 2} ${r * 2}`} aria-hidden="true">
      <circle cx={r} cy={r} r={r} fill={color} opacity={0.22} />
      <polygon points={pts.join(" ")} fill={color} />
    </svg>
  );
}

export { AXIAL_TILT };
