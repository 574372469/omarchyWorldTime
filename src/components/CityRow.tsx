import { memo, useMemo } from "react";
import { alpha, darken, mix } from "../lib/color";
import { greeting } from "../lib/greetings";
import { litAt, sunTimes } from "../lib/solar";
import { DaylightStrip } from "./DaylightStrip";
import {
  dayLabel,
  dayDelta,
  formatDate,
  formatTime,
  localParts,
  meridiem,
  phaseFor,
  relativeOffsetLabel,
  utcOffsetLabel,
  zoneAbbr,
  zoneOffsetMinutes,
  zoneParts,
  type City,
} from "../lib/time";

export interface RowProps {
  city: City;
  index: number;
  now: number;
  localOffset: number;
  hour24: boolean;
  offsetMode: "home" | "utc";
  locale: string;
  picked: boolean;
  dragging: boolean;
  dragOffset: number;
  shift: number;
  bg: string;
  fg: string;
  accent: string;
  daylightMarker: string;
  rounded: boolean;
  compact: boolean;
  onPick: () => void;
  onToggleHour24: () => void;
  onToggleOffset: () => void;
  onRemove?: () => void;
  onDragStart: (index: number, clientY: number) => void;
  onDragMove: (clientY: number) => void;
  onDragEnd: () => void;
  registerRow: (index: number, el: HTMLElement | null) => void;
}

const PHASE_FILL = { day: 0.1, night: 0.035, dawn: 0.07, dusk: 0.07 } as const;

export const CityRow = memo(function CityRow({
  city,
  index,
  now,
  localOffset,
  hour24,
  offsetMode,
  locale,
  picked,
  dragging,
  dragOffset,
  shift,
  bg,
  fg,
  accent,
  daylightMarker,
  rounded,
  compact,
  onPick,
  onToggleHour24,
  onToggleOffset,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
  registerRow,
}: RowProps) {
  const dim = darken(fg, 1.55);
  const fainter = darken(fg, 2.1);

  const offset = useMemo(() => zoneOffsetMinutes(city.id, now), [city.id, now]);
  const parts = useMemo(() => zoneParts(city.id, now), [city.id, now]);
  const local = useMemo(() => localParts(now), [now]);
  const day = dayLabel(dayDelta(parts, local));
  const date = formatDate(city.id, now, locale);
  const phase = phaseFor(parts.hour);
  const greet = greeting(city.id, parts.hour);
  const abbr = zoneAbbr(city.id, now);
  const rel = relativeOffsetLabel(offset, localOffset);
  const offsetText = offsetMode === "utc" ? utcOffsetLabel(offset) : rel;

  const fill = picked ? PHASE_FILL.day + 0.05 : PHASE_FILL[phase];
  const background = mix(bg, fg, fill);
  const minutes = parts.hour * 60 + parts.minute;

  // Sunrise and sunset for this city's own day; the strip and its marker both
  // read from them, so the sun never sits in the dark.
  const sun = useMemo(
    () =>
      city.lat !== undefined && city.lon !== undefined
        ? sunTimes(city.lat, city.lon, now, offset)
        : null,
    [city.lat, city.lon, now, offset],
  );
  const lit = sun ? litAt(sun, minutes) : minutes >= 6 * 60 && minutes < 18 * 60;

  return (
    <div
      ref={(el) => registerRow(index, el)}
      className={`row${picked ? " is-picked" : ""}${dragging ? " is-dragging" : ""}`}
      style={{
        background,
        borderRadius: rounded ? 6 : 0,
        transform: `translateY(${dragOffset + shift}px)`,
        transition: dragging ? "none" : "transform 130ms cubic-bezier(0.23,1,0.32,1)",
        zIndex: dragging ? 5 : picked ? 2 : 1,
        ["--row-fg" as string]: fg,
        ["--row-dim" as string]: dim,
        ["--row-fainter" as string]: fainter,
        ["--row-accent" as string]: accent,
      }}
      role="button"
      tabIndex={0}
      aria-pressed={picked}
      aria-label={`${city.label}, ${formatTime(parts, hour24)} ${hour24 ? "" : meridiem(parts)}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;
        const startY = e.clientY;
        let armed = false;
        const move = (ev: PointerEvent) => {
          const dy = ev.clientY - startY;
          if (!armed) {
            if (Math.abs(dy) < 4) return;
            armed = true;
            onDragStart(index, startY);
          }
          onDragMove(ev.clientY);
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", up);
          if (armed) onDragEnd();
          else onPick();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
      }}
    >
      <div className="row-main">
        <div className="row-labels">
          <div className="row-name">{city.label}</div>
          <div className="row-meta-wrap">
            <div className="row-meta">
              <span className="row-date">{date}</span>
              {day ? (
                <>
                  <span className="row-dot">·</span>
                  <span className="row-day">{day}</span>
                </>
              ) : null}
            </div>
            {!compact && (
              <div className="row-greeting" aria-hidden="true">
                <span>{greet.text}</span>
                {greet.roman ? <span className="row-roman">{greet.roman}</span> : null}
              </div>
            )}
          </div>
        </div>

        <div className="row-time-block">
          <button
            type="button"
            className="row-time"
            onClick={(e) => {
              e.stopPropagation();
              onToggleHour24();
            }}
            title={hour24 ? "Switch to 12-hour time" : "Switch to 24-hour time"}
          >
            <span className="row-clock">{formatTime(parts, hour24)}</span>
            {!hour24 && <span className="row-meridiem">{meridiem(parts)}</span>}
          </button>
          <button
            type="button"
            className="row-offset"
            onClick={(e) => {
              e.stopPropagation();
              onToggleOffset();
            }}
            title={
              offsetMode === "home" ? "Show the zone's own offset" : "Show the distance from here"
            }
          >
            <span className="row-abbr">{abbr}</span>
            {offsetText ? <span className="row-rel">{offsetText}</span> : null}
          </button>
        </div>
      </div>

      <div className="row-strip">
        <DaylightStrip
          sun={sun}
          minutes={minutes}
          nowMs={now}
          lit={lit}
          fg={fg}
          fainter={fainter}
          daylightMarker={daylightMarker}
          rounded={rounded}
        />
      </div>

      {onRemove && (
        <button
          type="button"
          className="row-remove"
          aria-label={`Remove ${city.label}`}
          title={`Remove ${city.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{ background: mix(bg, fg, 0.14), borderColor: alpha(fg, 0.35), color: dim }}
        >
          ×
        </button>
      )}
    </div>
  );
});
