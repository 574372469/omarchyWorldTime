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

/** How often a running clock re-checks itself against the system clock. */
const RESYNC_MS = 30_000;

/**
 * A clock that ticks on the second and keeps itself honest.
 *
 * The time shown is always read from the system clock, never counted up: a
 * laptop that slept for an hour, a background tab whose timers were throttled,
 * or a timer that fired late all correct themselves on the next tick. Ticks
 * are scheduled to the next whole second, and a periodic resync catches a
 * timer that has drifted, a clock that was set while the app was open, and a
 * machine that woke from sleep without telling us.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer = 0;
    let resync = 0;

    const tick = () => {
      const t = Date.now();
      setNow(t);
      // Sleep to just past the next whole second, so the digits change as the
      // second does rather than at whatever phase the interval began.
      const delay = 1000 - (t % 1000) + 2;
      timer = window.setTimeout(tick, delay);
    };

    const start = () => {
      stop();
      // Reading the clock first also covers waking up: the first tick shows
      // the true time instead of whatever was on screen before sleeping.
      tick();
      resync = window.setInterval(() => setNow(Date.now()), RESYNC_MS);
    };
    const stop = () => {
      window.clearTimeout(timer);
      window.clearInterval(resync);
      timer = 0;
      resync = 0;
    };

    const onVisibility = () => {
      // A hidden tab's timers are throttled, so it stops; coming back reads
      // the clock at once rather than resuming from a stale value.
      if (document.hidden) stop();
      else start();
    };
    // Browsers do not fire timers while a machine sleeps. Coming back to the
    // tab, the window or the page re-reads the clock; `resume` covers browsers
    // that implement the Page Lifecycle API, and costs nothing where it is absent.
    const onWake = () => start();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) start();
    };

    // A hidden tab keeps no timer at all. The state starts at the time of the
    // render that mounted it, and coming back reads the clock again.
    if (!document.hidden) start();

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("resume", onWake);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onWake);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("resume", onWake);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onWake);
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
