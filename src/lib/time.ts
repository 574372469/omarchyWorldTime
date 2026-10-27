// Time-zone math. Where Elsewhen shells out to `date` for offsets, the web
// platform hands them to us through Intl.

import cityData from "../data/cities.json";
import { t, type Lang } from "./i18n";

export type City = { id: string; label: string; lat?: number; lon?: number };

/** [name, zone, lat, lon, rank] — Omarchy's own city list. */
type RawCity = [string, string, number, number, number];

export const CITIES: (City & { rank: number })[] = (cityData as RawCity[]).map(
  ([label, id, lat, lon, rank]) => ({ id, label, lat, lon, rank }),
);

const zoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let f = zoneFormatterCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    zoneFormatterCache.set(zone, f);
  }
  return f;
}

export interface ZoneParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
}

function partsOf(zone: string, ms: number): ZoneParts {
  const parts = partsFormatter(zone).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const year = get("year");
  const month = get("month") - 1;
  const day = get("day");
  const hour = get("hour") % 24;
  const minute = get("minute");
  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
  return { year, month, day, weekday, hour, minute };
}

/** Minutes east of UTC for `zone` at `ms`, DST included. */
export function zoneOffsetMinutes(zone: string, ms: number): number {
  const p = partsOf(zone, ms);
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute);
  const minuteFloor = Math.floor(ms / 60000) * 60000;
  return Math.round((asUtc - minuteFloor) / 60000);
}

export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function zoneParts(zone: string, ms: number): ZoneParts {
  return partsOf(zone, ms);
}

/** Resolve a wall-clock minute on the reference instant's local date. */
export function instantAtWallMinute(zone: string, reference: number, minute: number): number {
  const date = zoneParts(zone, reference);
  const wall = Date.UTC(date.year, date.month, date.day) +
    Math.max(0, Math.min(1439, Math.round(minute))) * 60000;
  const offsets = new Set([zoneOffsetMinutes(zone, reference)]);
  for (const hours of [-48, -24, -12, 0, 12, 24, 48]) {
    offsets.add(zoneOffsetMinutes(zone, wall + hours * 3600000));
  }
  const candidates = [...offsets].map((offset) => {
    const instant = wall - offset * 60000;
    const actual = zoneParts(zone, instant);
    const actualWall = Date.UTC(actual.year, actual.month, actual.day, actual.hour, actual.minute);
    return { instant, delta: actualWall - wall };
  });
  const exact = candidates.filter((c) => c.delta === 0);
  if (exact.length) {
    // On a repeated hour, stay in the occurrence nearest the reference instant.
    return exact.reduce((a, b) =>
      Math.abs(a.instant - reference) <= Math.abs(b.instant - reference) ? a : b,
    ).instant;
  }
  // In a skipped hour, move forward by the size of the clock change.
  const after = candidates.filter((c) => c.delta > 0);
  return (after.length ? after : candidates).reduce((a, b) =>
    Math.abs(a.delta) <= Math.abs(b.delta) ? a : b,
  ).instant;
}

const canonicalCache = new Map<string, string>();
/** Resolve aliases such as Asia/Calcutta using the browser's time-zone database. */
export function canonicalZone(zone: string): string {
  let canonical = canonicalCache.get(zone);
  if (canonical === undefined) {
    canonical = partsFormatter(zone).resolvedOptions().timeZone;
    canonicalCache.set(zone, canonical);
  }
  return canonical;
}

/** The viewer's own wall clock, without a formatter. */
export function localParts(ms: number): ZoneParts {
  const d = new Date(ms);
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    weekday: d.getDay(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

const zoneNameCache = new Map<string, Intl.DateTimeFormat>();
function zoneNameFormatter(
  zone: string,
  locale: string,
  style: "short" | "longGeneric",
): Intl.DateTimeFormat {
  const key = `${locale}|${style}|${zone}`;
  let f = zoneNameCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: style });
    zoneNameCache.set(key, f);
  }
  return f;
}

/** The zone's name in `locale`: short ("EST") or generic long ("Japan Time"). */
export function zoneName(zone: string, locale: string, style: "short" | "longGeneric"): string {
  const part = zoneNameFormatter(zone, locale, style)
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part ? part.value : "";
}

/** The zone's own short name: "EST", "JST", or "GMT+8" where it has none. */
export function zoneAbbr(zone: string, ms: number, locale = "en-US"): string {
  const part = zoneNameFormatter(zone, locale, "short")
    .formatToParts(new Date(ms))
    .find((p) => p.type === "timeZoneName");
  return part ? part.value : "";
}

/** True for "GMT+8", "UTC+5:30": a name that is only the offset again. */
export function isNumericAbbr(abbr: string): boolean {
  return /^(GMT|UTC)\s*[+\-−]/.test(abbr);
}

export function labelForZone(zone: string): string {
  return zone.split("/").pop()!.replace(/_/g, " ");
}

/** A stored zone the browser no longer knows would throw on every tick. */
export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}

export function pad2(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

/** Minutes since midnight as HH:MM, wrapping a value outside the day. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function formatTime(p: ZoneParts, hour24: boolean): string {
  if (hour24) return `${pad2(p.hour)}:${pad2(p.minute)}`;
  const h = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h}:${pad2(p.minute)}`;
}

export function meridiem(p: ZoneParts): string {
  return p.hour < 12 ? "AM" : "PM";
}

/** Calendar-field day difference, so DST cannot skew it. */
export function dayDelta(a: ZoneParts, b: ZoneParts): number {
  return Math.round(
    (Date.UTC(a.year, a.month, a.day) - Date.UTC(b.year, b.month, b.day)) / 86400000,
  );
}

export function dayLabel(delta: number, lang: Lang = "en"): string {
  if (delta === 0) return "";
  if (delta === 1) return t(lang, "tomorrow");
  if (delta === -1) return t(lang, "yesterday");
  return delta > 0
    ? t(lang, "daysAhead", { n: delta })
    : t(lang, "daysBehind", { n: -delta });
}

/** Absolute offset: "UTC+2", "UTC-3:30", "UTC". */
export function utcOffsetLabel(minutes: number): string {
  if (!Number.isFinite(minutes)) return "";
  const total = Math.round(minutes);
  if (total === 0) return "UTC";
  const abs = Math.abs(total);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${total < 0 ? "-" : "+"}${h}${m === 0 ? "" : ":" + pad2(m)}`;
}

/** "+9h" or "-3.5h" from the viewer's clock; "" on the viewer's own offset. */
export function relativeOffsetLabel(zoneMinutes: number, localMinutes: number): string {
  const diff = zoneMinutes - localMinutes;
  if (diff === 0) return "";
  const hours = Math.round((diff / 60) * 10) / 10;
  return `${diff > 0 ? "+" : ""}${hours}h`;
}

export type Phase = "day" | "dawn" | "dusk" | "night";

export function phaseFor(hour: number): Phase {
  if (hour < 6 || hour >= 20) return "night";
  if (hour < 8) return "dawn";
  if (hour < 17) return "day";
  return "dusk";
}

export function dayProgress(p: ZoneParts): number {
  return (p.hour * 60 + p.minute) / 1440;
}

export function formatDate(zone: string, ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(ms));
}

export function usesTwentyFourHour(locale: string): boolean {
  try {
    const opts = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions();
    return opts.hourCycle === "h23" || opts.hourCycle === "h24";
  } catch {
    return true;
  }
}

// ---- the zone catalog

export interface ZoneOption {
  value: string;
  label: string;
  description: string;
  /** The browser's own spelling, so saved cities and the catalog compare equal. */
  canonical: string;
  /** Other spellings of the same zone, searchable but never shown twice. */
  aliases: string[];
}

let catalogCache: ZoneOption[] | null = null;

export function zoneCatalog(): ZoneOption[] {
  if (catalogCache) return catalogCache;
  const byCanonical = new Map<string, ZoneOption>();
  const offer = (id: string, label: string) => {
    // Both sources are already valid zone IDs, so canonicalizing is enough.
    const canonical = canonicalZone(id);
    const found = byCanonical.get(canonical);
    if (found) {
      if (found.value !== id) found.aliases.push(id);
      return;
    }
    byCanonical.set(canonical, { value: id, label, description: id, canonical, aliases: [] });
  };

  const supported = (
    Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf?.("timeZone");
  const ids = supported && supported.length > 0 ? supported : CITIES.map((c) => c.id);
  // Bundled names win; every browser spelling stays searchable as an alias.
  for (const c of CITIES) offer(c.id, c.label);
  for (const id of ids) offer(id, labelForZone(id));
  offer("UTC", "UTC");

  const out = [...byCanonical.values()];
  out.sort((a, b) => a.label.localeCompare(b.label));
  catalogCache = out;
  return out;
}

/** The viewer's zone, then New York, London, Dubai and Sydney, without repeats. */
export function seedCities(home = localZone()): City[] {
  const zones = [home, "America/New_York", "Europe/London", "Asia/Dubai", "Australia/Sydney"];
  return [...new Set(zones)].map((id) => findCity(id) ?? { id, label: labelForZone(id) });
}

export function findCity(zone: string): City | undefined {
  const c = CITIES.find((x) => x.id === zone);
  return c ? { id: c.id, label: c.label, lat: c.lat, lon: c.lon } : undefined;
}
