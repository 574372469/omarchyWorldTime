// The name a zone goes by where it is, written in the language spoken there.
// Intl's generic zone names do not follow daylight saving, so they read the
// same all year; the country each zone belongs to comes from IANA's own table.

import { ZONE_COUNTRY } from "../data/zoneCountries";
import { canonicalZone, zoneName } from "./time";

/** Countries whose likely language the browser carries no zone names for. */
const FALLBACK_LANG: Record<string, string> = {
  AS: "en",
  BQ: "nl",
  CW: "nl",
  HT: "fr",
  MV: "en",
  NP: "hi",
  PG: "en",
  PW: "en",
  PY: "es",
  TK: "en",
  TV: "en",
  VU: "fr",
  WS: "en",
};

function maximize(tag: string): string | null {
  if (!tag) return null;
  try {
    return new Intl.Locale(tag).maximize().toString();
  } catch {
    return null;
  }
}

const localeCache = new Map<string, string | null>();

/** The language tag a zone's own name is written in, or null when unknown. */
function nativeLocale(zone: string): string | null {
  let tag = localeCache.get(zone);
  if (tag !== undefined) return tag;
  const country = ZONE_COUNTRY[zone] ?? ZONE_COUNTRY[canonicalZone(zone)];
  tag = country ? maximize(`und-${country}`) : null;
  if (tag && Intl.DateTimeFormat.supportedLocalesOf([tag]).length === 0) {
    // A country whose language has no zone names here falls back to a
    // neighbouring one its readers also know, never to the browser's own.
    tag = maximize(FALLBACK_LANG[country] ?? "en");
  }
  localeCache.set(zone, tag);
  return tag;
}

function safeName(zone: string, locale: string): string {
  try {
    return zoneName(zone, locale, "longGeneric");
  } catch {
    // A zone the browser cannot format has no name to show.
    return "";
  }
}

/** The zone's own language tag, for a `lang` attribute. */
export function nativeLang(zone: string): string | undefined {
  return nativeLocale(zone) ?? undefined;
}

/** The zone's name in its own local language: "日本標準時", "Eastern Time". */
export function nativeZoneName(zone: string): string {
  const locale = nativeLocale(zone);
  return locale ? safeName(zone, locale) : "";
}

/** The zone's name in the language the panel is drawn in: "日本标准时间". */
export function targetZoneName(zone: string, locale: string): string {
  // The catalog's single non-geographic entry reads best as it is.
  if (zone === "UTC") return "UTC";
  return safeName(zone, locale);
}
