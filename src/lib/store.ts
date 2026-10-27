import { useCallback, useEffect, useRef, useState } from "react";
import { canonicalZone, findCity, isValidZone, type City } from "./time";

const KEY = "omarchy-world-clock:v1";

export interface Settings {
  theme: string;
  /** null follows the locale's own clock. */
  hour24: boolean | null;
  offsetMode: "home" | "utc";
  rounded: boolean;
  /** "auto" follows the browser's languages. */
  lang: string;
  cities: City[];
}

function read(): Partial<Settings> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<Settings>) : {};
  } catch {
    return {};
  }
}

export function loadSettings(seed: City[]): Settings {
  const stored = read();
  const saved = Array.isArray(stored.cities) && stored.cities.length > 0
    ? stored.cities.filter(
        (c) =>
          c &&
          typeof c.id === "string" &&
          typeof c.label === "string" &&
          isValidZone(c.id),
      )
    : seed;
  // Keep the actual local zone first, even after travelling or loading an old order.
  const cities = seed.slice(0, 1);
  // Older saves may hold two spellings of one zone; the browser knows which.
  const seen = new Set(cities.map((c) => canonicalZone(c.id)));
  for (const city of saved) {
    const canonical = canonicalZone(city.id);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const known = findCity(city.id);
    cities.push(known ? { ...known, label: city.label } : { id: city.id, label: city.label });
  }
  return {
    theme: typeof stored.theme === "string" ? stored.theme : "",
    hour24: typeof stored.hour24 === "boolean" ? stored.hour24 : null,
    offsetMode: stored.offsetMode === "utc" ? "utc" : "home",
    rounded: stored.rounded === true,
    lang: typeof stored.lang === "string" ? stored.lang : "auto",
    cities,
  };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode, quota: the app still works for this session */
  }
}

export function usePersistentSettings(seed: City[]) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings(seed));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveSettings(settings);
  }, [settings]);
  const update = useCallback(
    (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  );
  return [settings, update, setSettings] as const;
}

/** A clock that ticks on the second, paused while the tab is hidden. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let id = 0;
    const tick = () => setNow(Date.now());
    const start = () => {
      tick();
      id = window.setInterval(tick, 1000);
    };
    const stop = () => window.clearInterval(id);
    const onVisibility = () => {
      stop();
      if (!document.hidden) start();
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return now;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
