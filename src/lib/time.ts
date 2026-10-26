// Time-zone math. Where Elsewhen shells out to `date` for offsets, the web
// platform hands them to us through Intl.

import cityData from "../data/cities.json";

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

const abbrCache = new Map<string, Intl.DateTimeFormat>();
export function zoneAbbr(zone: string, ms: number): string {
  let f = abbrCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" });
    abbrCache.set(zone, f);
  }
  const part = f.formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName");
  return part ? part.value.replace(/^GMT/, "UTC") : "";
}

export function labelForZone(zone: string): string {
  return zone.split("/").pop()!.replace(/_/g, " ");
}

export function pad2(n: number): string {
  return (n < 10 ? "0" : "") + n;
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

export function dayLabel(delta: number): string {
  if (delta === 0) return "";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  return delta > 0 ? `+${delta} days` : `-${-delta} day${delta === -1 ? "" : "s"}`;
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
}

let catalogCache: ZoneOption[] | null = null;

export function zoneCatalog(): ZoneOption[] {
  if (catalogCache) return catalogCache;
  const seen = new Set<string>();
  const out: ZoneOption[] = [];
  const offer = (id: string, label: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ value: id, label, description: id });
  };

  const supported = (
    Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
  ).supportedValuesOf?.("timeZone");
  const ids = supported && supported.length > 0 ? supported : CITIES.map((c) => c.id);
  for (const id of ids) if (id.includes("/")) offer(id, labelForZone(id));
  for (const c of CITIES) offer(c.id, c.label);

  out.sort((a, b) => a.label.localeCompare(b.label));
  catalogCache = out;
  return out;
}

/** Cities to open with: here, plus four spread round the clock from it. */
export function seedCities(now = Date.now()): City[] {
  const home = localZone();
  const homeOffset = zoneOffsetMinutes(home, now);
  const homeCity = CITIES.find((c) => c.id === home);
  const picked: City[] = [{ id: home, label: homeCity ? homeCity.label : labelForZone(home) }];

  const candidates = CITIES.filter((c) => c.id !== home).map((c) => ({
    city: c,
    offset: zoneOffsetMinutes(c.id, now),
  }));

  while (picked.length < 5 && candidates.length > 0) {
    let best = 0;
    let bestScore = -1;
    for (let i = 0; i < candidates.length; i++) {
      const o = candidates[i].offset;
      let nearest = Math.abs(o - homeOffset);
      for (const p of picked) {
        const po = zoneOffsetMinutes(p.id, now);
        nearest = Math.min(nearest, Math.abs(o - po));
      }
      const score = nearest + candidates[i].city.rank * 0.01;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    const chosen = candidates.splice(best, 1)[0];
    picked.push({ id: chosen.city.id, label: chosen.city.label });
  }
  return picked;
}

export function findCity(zone: string): City | undefined {
  const c = CITIES.find((x) => x.id === zone);
  return c ? { id: c.id, label: c.label, lat: c.lat, lon: c.lon } : undefined;
}
