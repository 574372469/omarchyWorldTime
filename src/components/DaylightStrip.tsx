import { alpha } from "../lib/color";
import { t, type Lang } from "../lib/i18n";
import { litSpans, moonPhase, type SunTimes } from "../lib/solar";

interface Props {
  sun: SunTimes | null;
  /** Minutes since local midnight. */
  minutes: number;
  nowMs: number;
  lit: boolean;
  fg: string;
  fainter: string;
  daylightMarker: string;
  rounded: boolean;
  lang: Lang;
}

/** A city's 24 hours, midnight to midnight: daylight lit, a sun or moon at now. */
export function DaylightStrip({
  sun,
  minutes,
  nowMs,
  lit,
  fg,
  fainter,
  daylightMarker,
  rounded,
  lang,
}: Props) {
  const spans = sun ? litSpans(sun) : [{ x0: 6 / 24, x1: 18 / 24 }];
  const progress = minutes / 1440;
  const marks = sun && sun.kind === "normal" ? [sun.riseMinutes, sun.setMinutes] : [];
  const phase = moonPhase(nowMs);

  const label =
    sun?.kind === "midnightSun"
      ? t(lang, "midnightSun")
      : sun?.kind === "polarNight"
        ? t(lang, "polarNight")
        : sun
          ? t(lang, "sunrise", { rise: fmt(sun.riseMinutes), set: fmt(sun.setMinutes) })
          : t(lang, "allDay");

  return (
    <div
      className="strip"
      role="img"
      aria-label={`${label}; ${t(lang, "localTime", { time: fmt(minutes) })}`}
      style={{ height: 18 }}
    >
      <div
        className="strip-track"
        style={{ background: alpha(fg, 0.1), borderRadius: rounded ? 999 : 0 }}
      >
        {spans.map((s, i) => (
          <span
            key={i}
            className="strip-lit"
            style={{
              left: `${s.x0 * 100}%`,
              width: `${(s.x1 - s.x0) * 100}%`,
              background: alpha(fg, 0.28),
              borderRadius: rounded ? 999 : 0,
            }}
          />
        ))}
      </div>

      {marks.map((m, i) => (
        <span
          key={i}
          className="strip-mark"
          style={{ left: `${((m ?? 0) / 1440) * 100}%`, color: fainter }}
          aria-hidden="true"
        >
          {i === 0 ? "↑" : "↓"}
        </span>
      ))}

      <span className="strip-now" style={{ left: `${progress * 100}%` }} aria-hidden="true">
        {lit ? (
          <span className="strip-dot" style={{ background: daylightMarker }} />
        ) : (
          <MoonGlyph phase={phase} color={fg} />
        )}
      </span>
    </div>
  );
}

function fmt(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Tonight's moon, drawn: a faint full disc under the lit part. */
export function MoonGlyph({
  phase,
  color,
  size = 10,
}: {
  phase: number;
  color: string;
  size?: number;
}) {
  const r = size / 2;
  const theta = 2 * Math.PI * phase;
  const squash = Math.cos(theta);
  const side = phase > 0.5 ? -1 : 1;
  const pts: string[] = [];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const t = (Math.PI * i) / steps;
    pts.push(`${r + side * r * Math.sin(t)},${r - r * Math.cos(t)}`);
  }
  for (let i = steps; i >= 0; i--) {
    const t = (Math.PI * i) / steps;
    pts.push(`${r + side * r * squash * Math.sin(t)},${r - r * Math.cos(t)}`);
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={r} cy={r} r={r} fill={color} opacity={0.22} />
      <polygon points={pts.join(" ")} fill={color} />
    </svg>
  );
}
