import { memo, useEffect, useMemo, useRef } from "react";
import { alpha, darken, mix } from "../lib/color";
import { localizedCity } from "../lib/cityNames";
import { greeting } from "../lib/greetings";
import { t, type Lang } from "../lib/i18n";
import { litAt, sunTimes } from "../lib/solar";
import { DaylightStrip } from "./DaylightStrip";
import {
  dayLabel,
  dayDelta,
  formatDate,
  formatTime,
  isNumericAbbr,
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
  previewing: boolean;
  onPreview: (zone: string, minutes: number) => void;
  localOffset: number;
  hour24: boolean;
  offsetMode: "home" | "utc";
  locale: string;
  lang: Lang;
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
  /** The viewer's own row: pinned first, and it cannot be removed. */
  home: boolean;
  onPick: () => void;
  onToggleHour24: () => void;
  onToggleOffset: () => void;
  onRemove?: () => void;
  onDragStart: (index: number, clientY: number) => void;
  onDragMove: (clientY: number) => void;
  onDragEnd: (cancelled?: boolean) => void;
  onReorder: (index: number, direction: -1 | 1) => void;
  registerRow: (index: number, el: HTMLElement | null) => void;
}

const PHASE_FILL = { day: 0.1, night: 0.035, dawn: 0.07, dusk: 0.07 } as const;

export const CityRow = memo(function CityRow({
  city,
  index,
  now,
  previewing,
  onPreview,
  localOffset,
  hour24,
  offsetMode,
  locale,
  lang,
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
  home,
  onPick,
  onToggleHour24,
  onToggleOffset,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
  onReorder,
  registerRow,
}: RowProps) {
  const stopPointer = useRef<(() => void) | null>(null);
  useEffect(() => () => stopPointer.current?.(), []);

  const dim = darken(fg, 1.55);
  const fainter = darken(fg, 2.1);

  const offset = useMemo(() => zoneOffsetMinutes(city.id, now), [city.id, now]);
  const parts = useMemo(() => zoneParts(city.id, now), [city.id, now]);
  const local = useMemo(() => localParts(now), [now]);
  const day = dayLabel(dayDelta(parts, local), lang);
  const date = formatDate(city.id, now, locale);
  const phase = phaseFor(parts.hour);
  const greet = greeting(city.id, parts.hour);
  // "GMT+8" is only the offset wearing another name, so it is written the way
  // the rest of the panel writes offsets: UTC+8. Real abbreviations (EST, JST)
  // stay as they are.
  const rawAbbr = zoneAbbr(city.id, now, locale);
  const abbr = isNumericAbbr(rawAbbr) ? utcOffsetLabel(offset) : rawAbbr;
  const rel = relativeOffsetLabel(offset, localOffset);
  const absolute = utcOffsetLabel(offset);
  const offsetText = offsetMode === "utc" ? (abbr === absolute ? "" : absolute) : rel;
  const name = localizedCity(city.id, lang) || city.label;

  const fill = picked ? PHASE_FILL.day + 0.05 : PHASE_FILL[phase];
  const background = mix(bg, fg, fill);
  const minutes = parts.hour * 60 + parts.minute;

  // Sunrise and sunset for this city's own day; the strip and its marker both
  // read from them, so the sun never sits in the dark.
  const sun = useMemo(
    () =>
      city.lat !== undefined && city.lon !== undefined
        ? sunTimes(city.lat, city.lon, now, offset, city.id)
        : null,
    [city.id, city.lat, city.lon, now, offset],
  );
  const lit = sun ? litAt(sun, minutes) : minutes >= 6 * 60 && minutes < 18 * 60;

  return (
    <div
      ref={(el) => registerRow(index, el)}
      className={`row${picked ? " is-picked" : ""}${dragging ? " is-dragging" : ""}${
        home ? " is-home" : ""
      }`}
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
      aria-label={`${name}, ${formatTime(parts, hour24)} ${hour24 ? "" : meridiem(parts)}`}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (!e.isPrimary || e.button !== 0) return;
        const target = e.target as HTMLElement;
        const handle = target.closest(".row-grip");
        if (target.closest("button") && !handle) return;
        stopPointer.current?.();
        const row = e.currentTarget;
        const startX = e.clientX;
        const startY = e.clientY;
        const pointerId = e.pointerId;
        const canDrag = !home && (e.pointerType === "mouse" || !!handle);
        let armed = false;
        let moved = false;
        if (canDrag) row.setPointerCapture(pointerId);
        const cleanup = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          window.removeEventListener("pointercancel", cancel);
          window.removeEventListener("blur", blur);
          if (row.hasPointerCapture(pointerId)) row.releasePointerCapture(pointerId);
          stopPointer.current = null;
        };
        const move = (ev: PointerEvent) => {
          if (ev.pointerId !== pointerId) return;
          if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
          moved = true;
          if (!canDrag) return;
          if (ev.cancelable) ev.preventDefault();
          if (!armed) {
            armed = true;
            onDragStart(index, startY);
          }
          onDragMove(ev.clientY);
        };
        const up = (ev: PointerEvent) => {
          if (ev.pointerId !== pointerId) return;
          cleanup();
          if (armed) onDragEnd();
          else if (!moved && !handle) onPick();
        };
        const cancel = (ev: PointerEvent) => {
          if (ev.pointerId !== pointerId) return;
          cleanup();
          if (armed) onDragEnd(true);
        };
        const blur = () => {
          cleanup();
          if (armed) onDragEnd(true);
        };
        stopPointer.current = cleanup;
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", cancel);
        window.addEventListener("blur", blur);
      }}
    >
      {!home && (
        <button
          type="button"
          className="row-grip"
          aria-label={t(lang, "reorderCity", { city: name })}
          title={t(lang, "reorderCity", { city: name })}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              e.stopPropagation();
              onReorder(index, e.key === "ArrowUp" ? -1 : 1);
            }
          }}
        >
          <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
            {[3, 7, 11].flatMap((y) => [2, 6].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />))}
          </svg>
        </button>
      )}
      <div className="row-main">
        <div className="row-labels">
          <div className="row-name">
            <span className="row-city">{name}</span>
            {home && <span className="row-home">{t(lang, "home")}</span>}
          </div>
          <span className="row-zone" title={city.id}>{city.id}</span>
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
            title={t(lang, hour24 ? "hour24Title" : "hour12Title")}
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
            title={t(lang, offsetMode === "home" ? "offsetTitleHome" : "offsetTitleUtc")}
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
          lang={lang}
          city={name}
          previewing={previewing}
          onPreview={(value) => onPreview(city.id, value)}
        />
      </div>

      {onRemove && (
        <button
          type="button"
          className="row-remove"
          aria-label={t(lang, "removeCity", { city: name })}
          title={t(lang, "removeCity", { city: name })}
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
