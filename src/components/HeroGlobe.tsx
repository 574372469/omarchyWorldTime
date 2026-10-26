import { useMemo } from "react";
import { alpha, mix } from "../lib/color";
import world from "../data/world.json";
import { AXIAL_TILT, clipRingToDisc, decimateRing, project } from "../lib/solar";

const rings = (world as number[][]).map((r) => decimateRing(r, 2, 8));

interface Props {
  spin: number;
  size: number;
  fg: string;
  bg: string;
  accent: string;
  markerShown: boolean;
  markerLat: number;
  markerLon: number;
  /** 0 in the header, 1 once the big globe has landed: the × cross-fades in. */
  zoom: number;
  onClick: () => void;
}

/**
 * The little drawn globe that stands in for the word "World": it turns to
 * the city in focus, and is the door into globe mode.
 */
export function HeroGlobe({
  spin,
  size,
  fg,
  bg,
  accent,
  markerShown,
  markerLat,
  markerLon,
  zoom,
  onClick,
}: Props) {
  const r = size / 2 - 1;

  const landPaths = useMemo(() => {
    const out: string[] = [];
    for (const ring of rings) {
      if (ring.length < 40) continue;
      const poly = clipRingToDisc(ring, spin, 0, r);
      if (poly.length < 3) continue;
      out.push(
        poly.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
          " Z",
      );
    }
    return out;
  }, [spin, r]);

  const graticule = useMemo(() => {
    const out: string[] = [];
    const pathFor = (pts: [number, number][]) => {
      let d = "";
      let pen = false;
      for (const [lat, lon] of pts) {
        const p = project(lat, lon, spin, 0, r);
        if (p.visible) {
          d += `${pen ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
          pen = true;
        } else pen = false;
      }
      return d;
    };
    for (let lon = -90; lon < 90; lon += 90) {
      const pts: [number, number][] = [];
      for (let lat = -90; lat <= 90; lat += 6) pts.push([lat, lon]);
      out.push(pathFor(pts));
    }
    const eq: [number, number][] = [];
    for (let lon = -180; lon <= 180; lon += 6) eq.push([0, lon]);
    out.push(pathFor(eq));
    return out;
  }, [spin, r]);

  const marker = markerShown ? project(markerLat, markerLon, spin, 0, r) : null;
  const crossOpacity = Math.max(0, Math.min(1, (zoom - 0.2) / 0.35));

  return (
    <button
      type="button"
      className="hero-globe"
      onClick={onClick}
      aria-label="Open the globe"
      title="Spin the globe"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
        style={{ transform: `rotate(${AXIAL_TILT}deg)`, overflow: "visible" }}
      >
        <circle r={r} fill={mix(bg, fg, 0.16)} />
        <g clipPath="url(#hero-clip)">
          <defs>
            <clipPath id="hero-clip">
              <circle r={r} />
            </clipPath>
          </defs>
          {graticule.map((d, i) => (
            <path key={i} d={d} stroke={alpha(fg, 0.42)} strokeWidth={Math.max(1, r * 0.055)} fill="none" />
          ))}
          {landPaths.map((d, i) => (
            <path key={i} d={d} fill={alpha(fg, 1)} />
          ))}
          {marker?.visible && (
            <>
              <circle cx={marker.x} cy={marker.y} r={Math.max(1.6, r * 0.13)} fill={accent} />
              <circle
                cx={marker.x}
                cy={marker.y}
                r={Math.max(2, r * 0.25)}
                fill="none"
                stroke={alpha(accent, 0.65)}
                strokeWidth={Math.max(1, r * 0.045)}
              />
            </>
          )}
        </g>
        <circle r={r} fill="none" stroke={alpha(fg, 1)} strokeWidth={Math.max(1, r * 0.095)} />
      </svg>

      {crossOpacity > 0 && (
        <span
          className="hero-cross"
          aria-hidden="true"
          style={{
            opacity: crossOpacity,
            fontSize: Math.round(size * 0.8),
            color: alpha(fg, 0.9),
            transform: `rotate(${-AXIAL_TILT}deg)`,
          }}
        >
          ×
        </span>
      )}
    </button>
  );
}
