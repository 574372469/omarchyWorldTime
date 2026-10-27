import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CityRow } from "./components/CityRow";
import { CitySearch } from "./components/CitySearch";
import { Globe, type GlobeCity } from "./components/Globe";
import { HeroGlobe } from "./components/HeroGlobe";
import { ThemePicker } from "./components/ThemePicker";
import { localizedCity } from "./lib/cityNames";
import { localeOf, resolveLang, t } from "./lib/i18n";
import { useMediaQuery, useNow, usePersistentSettings } from "./lib/store";
import { themeById } from "./lib/themes";
import {
  canonicalZone,
  findCity,
  formatTime,
  instantAtWallMinute,
  labelForZone,
  localParts,
  localZone,
  seedCities,
  usesTwentyFourHour,
  zoneCatalog,
  zoneOffsetMinutes,
  type City,
} from "./lib/time";
import { useTheme } from "./lib/useTheme";

const OPEN_SPIN_MS = 1250;

/** Elsewhen's list-to-globe flight, at the speeds its panel uses. */
const OPEN_ZOOM_MS = 800;
const CLOSE_ZOOM_MS = 500;
const KNOCK_STAGGER = 0.09;
const KNOCK_MAX_LEAD = 0.5;
const KNOCK_THROW_X = 95;
const KNOCK_TILT = 14;
const KNOCK_SHRINK = 0.18;

/** How far into the knock row `index` is, 0..1, its lead capped as Elsewhen does. */
function knockAt(index: number, zoom: number): number {
  const lead = Math.min(KNOCK_MAX_LEAD, index * KNOCK_STAGGER);
  return Math.max(0, Math.min(1, (zoom - lead) / (1 - lead)));
}

/** Runs 0↔1 with Elsewhen's curves: out-quart in, in-out-cubic back. */
function useZoom(target: number, reducedMotion: boolean): number {
  const [zoom, setZoom] = useState(target);
  const from = useRef(target);
  const anim = useRef<number | null>(null);
  useEffect(() => {
    if (reducedMotion || from.current === target) {
      from.current = target;
      setZoom(target);
      return;
    }
    if (anim.current) cancelAnimationFrame(anim.current);
    const start = from.current;
    const dur = target > start ? OPEN_ZOOM_MS : CLOSE_ZOOM_MS;
    const goingIn = target > start;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = goingIn ? 1 - Math.pow(1 - k, 4) : k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const v = start + (target - start) * e;
      from.current = v;
      setZoom(v);
      anim.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    anim.current = requestAnimationFrame(step);
    return () => {
      if (anim.current) cancelAnimationFrame(anim.current);
    };
  }, [target, reducedMotion]);
  return zoom;
}

/** A zone's coordinates: the bundled city's, else its standard meridian. */
function coordsFor(zone: string): { lat: number; lon: number } {
  const c = findCity(zone);
  if (c && c.lat !== undefined && c.lon !== undefined) return { lat: c.lat, lon: c.lon };
  const offset = zoneOffsetMinutes(zone, Date.now());
  return { lat: 0, lon: Math.max(-180, Math.min(180, (offset / 60) * 15)) };
}

export default function App() {
  const seed = useMemo(() => seedCities(), []);
  const [settings, update] = usePersistentSettings(seed);
  const liveNow = useNow();
  const [preview, setPreview] = useState<number | null>(null);
  const now = preview ?? liveNow;

  // The panel speaks the browser's language unless one is chosen; the
  // 12/24-hour convention follows the same tag.
  const lang = useMemo(() => resolveLang(settings.lang), [settings.lang]);
  const locale = localeOf(lang, settings.lang);
  const theme = useMemo(() => themeById(settings.theme), [settings.theme]);
  const hour24 = settings.hour24 ?? usesTwentyFourHour(locale);
  const rounded = settings.rounded;
  useTheme(theme, rounded);

  const wide = useMediaQuery("(min-width: 900px)");
  const medium = useMediaQuery("(min-width: 640px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const here = useMemo(() => localZone(), []);
  const localOffset = useMemo(() => zoneOffsetMinutes(here, now), [here, now]);
  const local = useMemo(() => localParts(now), [now]);

  const [picked, setPicked] = useState<string | null>(null);
  const [globeMode, setGlobeMode] = useState(false);
  const [globeCity, setGlobeCity] = useState<GlobeCity | null>(null);
  // On a wide screen the globe is always there, so it is never "closed".
  const globeOn = globeMode || wide;
  // One number drives Elsewhen's list-to-globe flight: 0 the list, 1 the globe.
  const zoom = useZoom(globeOn ? 1 : 0, reducedMotion);

  // Whatever zone the viewer is actually in, pinned to the top of the list.
  // It may not be one of Omarchy's bundled cities — the row is then built
  // from the zone id, and its coordinates come from the standard meridian.
  const homeZone = settings.cities[0]?.id ?? here;
  const homeLabel =
    settings.cities[0]?.label ??
    (findCity(here)?.label ?? labelForZone(here));

  const focusZone = picked ?? homeZone;
  const focus = useMemo(() => coordsFor(focusZone), [focusZone]);

  // ---- the hero globe: an opening spin, then a turn to whatever is picked
  const [heroSpin, setHeroSpin] = useState(() => focus.lon);
  const spinRef = useRef(focus.lon);
  const spinAnim = useRef<number | null>(null);

  const spinTo = useCallback(
    (lon: number, turns = 0, ms = 700) => {
      if (spinAnim.current) cancelAnimationFrame(spinAnim.current);
      const from = spinRef.current;
      const to = from + ((((lon - from) % 360) + 540) % 360) - 180 + turns * 360;
      const start = performance.now();
      const dur = reducedMotion ? 0 : ms;
      const step = (t: number) => {
        const k = dur === 0 ? 1 : Math.min(1, (t - start) / dur);
        const e = 1 - Math.pow(1 - k, 4);
        spinRef.current = from + (to - from) * e;
        setHeroSpin(spinRef.current);
        spinAnim.current = k < 1 ? requestAnimationFrame(step) : null;
      };
      spinAnim.current = requestAnimationFrame(step);
    },
    [reducedMotion],
  );

  useEffect(() => {
    spinTo(focus.lon, 0, OPEN_SPIN_MS);
  }, [focus.lon, spinTo]);

  useEffect(() => () => {
    if (spinAnim.current) cancelAnimationFrame(spinAnim.current);
  }, []);

  // ---- rows
  const previewTime = (zone: string, minutes: number) => {
    setPreview((previous) => instantAtWallMinute(zone, previous ?? liveNow, minutes));
  };
  const pickCity = (id: string) => setPicked((p) => (p === id ? null : id));
  const toggleHour24 = () => update({ hour24: !hour24 });
  const toggleOffset = () =>
    update({ offsetMode: settings.offsetMode === "utc" ? "home" : "utc" });

  const addCity = (zone: string, label: string) => {
    // The zone, not its spelling, is a city's identity: Asia/Calcutta and
    // Asia/Kolkata are one place, and only one of them may be in the list.
    const canonical = canonicalZone(zone);
    if (settings.cities.some((c) => canonicalZone(c.id) === canonical)) return;
    update({ cities: [...settings.cities, { ...findCity(zone), id: zone, label }] });
  };

  // The first row is where the viewer is; it stays, and it stays on top.
  const removeCity = (zone: string) => {
    if (settings.cities[0]?.id === zone) return;
    if (settings.cities.length <= 1) return;
    update({ cities: settings.cities.filter((c) => c.id !== zone) });
    if (picked === zone) setPicked(null);
  };

  // ---- drag to reorder
  // Every row's pitch is measured at the grab: a row with a greeting is a
  // line taller than one without, so they are not all one height.
  type DragState = { index: number; offset: number; target: number; pitches: number[] };
  const [drag, setDrag] = useState<DragState | null>(null);
  // The pointer's listeners outlive the render that made them, so the drag is
  // mirrored in a ref: endDrag would otherwise commit the state it was born with.
  const dragRef = useRef<DragState | null>(null);
  const citiesRef = useRef(settings.cities);
  useEffect(() => {
    citiesRef.current = settings.cities;
  }, [settings.cities]);

  const rowEls = useRef<(HTMLElement | null)[]>([]);
  const dragStartY = useRef(0);
  // The list gains a hairline under the home row only once it has stuck.
  const listRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const registerRow = useCallback((i: number, el: HTMLElement | null) => {
    rowEls.current[i] = el;
  }, []);

  const applyDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const beginDrag = (index: number, clientY: number) => {
    // The home row is fixed to the top; nothing drags past it.
    if (index === 0) return;
    dragStartY.current = clientY;
    const pitches = citiesRef.current.map(
      (_, i) => (rowEls.current[i]?.offsetHeight ?? 60) + 14,
    );
    applyDrag({ index, offset: 0, target: index, pitches });
  };

  const moveDrag = (clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const offset = clientY - dragStartY.current;
    const count = citiesRef.current.length;
    const dir = offset < 0 ? -1 : 1;
    let left = Math.abs(offset);
    let passed = 0;
    for (let i = d.index + dir; i >= 0 && i < count; i += dir) {
      const pitch = d.pitches[i] ?? 74;
      if (left < pitch) {
        passed += left / pitch;
        break;
      }
      left -= pitch;
      passed += 1;
    }
    const raw = dir * passed;
    const held = d.target - d.index;
    const next = Math.abs(raw - held) >= 0.6 ? Math.round(raw) : held;
    // Slot 0 is the home row's; a dragged row stops at slot 1.
    const target = Math.max(1, Math.min(count - 1, d.index + next));
    applyDrag({ ...d, offset, target });
  };

  const endDrag = (cancelled = false) => {
    const d = dragRef.current;
    applyDrag(null);
    if (cancelled || !d || d.index === d.target) return;
    moveCity(d.index, d.target);
  };

  const moveCity = (from: number, to: number) => {
    const next = citiesRef.current.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update({ cities: next });
  };

  const reorderCity = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (index === 0 || target < 1 || target >= settings.cities.length) return;
    moveCity(index, target);
  };

  const rowShift = (index: number) => {
    if (!drag || index === drag.index) return 0;
    const pitch = drag.pitches[index] ?? 74;
    if (drag.index < drag.target && index > drag.index && index <= drag.target) return -pitch;
    if (drag.index > drag.target && index >= drag.target && index < drag.index) return pitch;
    return 0;
  };

  // ---- the home row's shadow
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => setStuck(el.scrollTop > 2);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [settings.cities.length, wide]);

  // ---- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) {
        // A focused timeline keeps its arrow keys; Esc still leaves the preview.
        if (e.key === "Escape" && e.target.type === "range" && preview !== null) {
          e.preventDefault();
          setPreview(null);
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "t" || e.key === "T") toggleHour24();
      else if (e.key === "g" || e.key === "G") setGlobeMode((v) => !v);
      else if (e.key === "Escape") {
        if (globeMode) setGlobeMode(false);
        else if (preview !== null) setPreview(null);
        else if (picked) setPicked(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Elsewhen's own caption: "It's 22:51 here in Singapore".
  const hereName = localizedCity(homeZone, lang) || homeLabel;
  const hereLine = t(lang, "hereTime", {
    time: formatTime(local, hour24),
    city: hereName,
  });

  const list = (
    <div className="list">
      {settings.cities.map((city: City, i) => {
        // Elsewhen knocks the rows aside as the globe zooms in: each row
        // leaves a beat after the one above it, throws out to its own side,
        // tilts, and shrinks as it falls.
        const k = wide ? 0 : knockAt(i, zoom);
        const side = i % 2 === 0 ? -1 : 1;
        const knockX = k * side * KNOCK_THROW_X;
        const knockY = k * k * 900;
        return (
          <div
            key={city.id}
            className={`row-slot${i === 0 ? " is-home" : ""}`}
            style={{
              transform: k > 0
                ? `translate(${knockX}px, ${knockY}px) rotate(${k * side * KNOCK_TILT}deg) scale(${1 - KNOCK_SHRINK * k})`
                : undefined,
              opacity: k > 0 ? 1 - k : 1,
              pointerEvents: k > 0.02 ? "none" : undefined,
            }}
            aria-hidden={globeMode && !wide}
          >
            <CityRow
              city={city}
              index={i}
              now={now}
              previewing={preview !== null}
              onPreview={previewTime}
              localOffset={localOffset}
              hour24={hour24}
              offsetMode={settings.offsetMode}
              locale={locale}
              lang={lang}
              picked={picked === city.id}
              dragging={drag?.index === i}
              dragOffset={drag?.index === i ? drag.offset : 0}
              shift={rowShift(i)}
              bg={theme.background}
              fg={theme.foreground}
              accent={theme.accent}
              daylightMarker="#E5C736"
              rounded={rounded}
              compact={!medium}
              home={i === 0}
              onPick={() => pickCity(city.id)}
              onToggleHour24={toggleHour24}
              onToggleOffset={toggleOffset}
              onRemove={i === 0 ? undefined : () => removeCity(city.id)}
              onDragStart={beginDrag}
              onDragMove={moveDrag}
              onDragEnd={endDrag}
              onReorder={reorderCity}
              registerRow={registerRow}
            />
          </div>
        );
      })}
      <CitySearch
        existing={settings.cities}
        fg={theme.foreground}
        accent={theme.accent}
        rounded={rounded}
        lang={lang}
        locale={locale}
        onPick={addCity}
        onClose={() => undefined}
      />
    </div>
  );

  return (
    <div className={`app${globeOn ? " is-globe" : ""}`}>
      <div className="scrim" aria-hidden="true" />

      <main className="panel" aria-label="World clock">
        <header className="hero">
          <p className="hero-caption">{hereLine}</p>
          {preview !== null && (
            <button className="preview-reset" type="button" onClick={() => setPreview(null)}>
              {t(lang, "previewActive")} · {t(lang, "returnToLive")}
            </button>
          )}
          <div className="hero-title">
            <span className="hero-word">World</span>
            <HeroGlobe
              spin={heroSpin}
              size={Math.round((medium ? 24 : 20) * 1.3)}
              fg={theme.foreground}
              bg={theme.background}
              accent={theme.accent}
              markerShown
              markerLat={focus.lat}
              markerLon={focus.lon}
              zoom={zoom}
              onClick={() => (wide ? setPicked(null) : setGlobeMode((v) => !v))}
            />
            <span className="hero-word">Clock</span>
          </div>
        </header>

        <div
          className="stage"
          data-globe={globeMode}
          style={{ ["--zoom" as string]: zoom }}
        >
          <div
            ref={listRef}
            className="stage-list"
            data-stuck={stuck}
            aria-hidden={globeMode && !wide}
          >
            {list}
          </div>
          <div className="stage-globe" aria-hidden={!globeOn}>
            <Globe
              now={now}
              tracked={settings.cities}
              homeZone={homeZone}
              hour24={hour24}
              bg={theme.background}
              fg={theme.foreground}
              accent={theme.accent}
              daylightMarker="#E5C736"
              focusLon={focus.lon}
              focusLat={focus.lat}
              focusShown={!!picked || !!globeCity}
              zoom={zoom}
              active={globeOn || zoom > 0}
              reducedMotion={reducedMotion}
              lang={lang}
              onSelect={(c) => setGlobeCity(c)}
              onExit={() => setGlobeMode(false)}
            />
          </div>
        </div>

        <footer className="bar">
          <button
            type="button"
            className="bar-button"
            onClick={toggleHour24}
            title={t(lang, hour24 ? "hour24Title" : "hour12Title")}
          >
            {hour24 ? "24h" : "12h"}
          </button>
          <button
            type="button"
            className="bar-button"
            onClick={toggleOffset}
            title={t(lang, settings.offsetMode === "utc" ? "offsetTitleUtc" : "offsetTitleHome")}
          >
            {settings.offsetMode === "utc" ? t(lang, "utcMode") : t(lang, "fromHere")}
          </button>
          <span className="bar-spacer" />
          <span className="bar-count">{t(lang, "count", { n: settings.cities.length, total: zoneCatalog().length })}</span>
          <a
            className="bar-button github-link"
            href="https://github.com/574372469/omarchyWorldTime"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            GitHub <span aria-hidden="true">↗</span>
          </a>
          <ThemePicker
            theme={theme}
            rounded={rounded}
            lang={lang}
            langChoice={settings.lang}
            onTheme={(id) => update({ theme: id })}
            onRounded={(v) => update({ rounded: v })}
            onLang={(choice) => update({ lang: choice })}
          />
        </footer>
      </main>
    </div>
  );
}
