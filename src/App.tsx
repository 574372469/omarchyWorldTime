import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CityRow } from "./components/CityRow";
import { CitySearch } from "./components/CitySearch";
import { Globe, type GlobeCity } from "./components/Globe";
import { HeroGlobe } from "./components/HeroGlobe";
import { ThemePicker } from "./components/ThemePicker";
import { useMediaQuery, useNow, usePersistentSettings } from "./lib/store";
import { themeById } from "./lib/themes";
import {
  CITIES,
  findCity,
  formatTime,
  labelForZone,
  localParts,
  localZone,
  seedCities,
  usesTwentyFourHour,
  zoneOffsetMinutes,
  type City,
} from "./lib/time";
import { useTheme } from "./lib/useTheme";

const OPEN_SPIN_MS = 1250;

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
  const now = useNow();

  // Omarchy's shell speaks English whatever the system locale, so the dates
  // here do too; only the 12/24-hour convention follows the locale.
  const locale = "en-US";
  const theme = useMemo(() => themeById(settings.theme), [settings.theme]);
  const hour24 = settings.hour24 ?? usesTwentyFourHour(navigator.language || "en-US");
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

  const focusZone = picked ?? settings.cities[0]?.id ?? here;
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
  const pickCity = (id: string) => setPicked((p) => (p === id ? null : id));
  const toggleHour24 = () => update({ hour24: !hour24 });
  const toggleOffset = () =>
    update({ offsetMode: settings.offsetMode === "utc" ? "home" : "utc" });

  const addCity = (zone: string, label: string) => {
    if (settings.cities.some((c) => c.id === zone)) return;
    update({ cities: [...settings.cities, { id: zone, label }] });
  };

  const removeCity = (zone: string) => {
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
  const registerRow = useCallback((i: number, el: HTMLElement | null) => {
    rowEls.current[i] = el;
  }, []);

  const applyDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const beginDrag = (index: number, clientY: number) => {
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
    const target = Math.max(0, Math.min(count - 1, d.index + next));
    applyDrag({ ...d, offset, target });
  };

  const endDrag = () => {
    const d = dragRef.current;
    applyDrag(null);
    if (!d || d.index === d.target) return;
    const next = citiesRef.current.slice();
    const [moved] = next.splice(d.index, 1);
    next.splice(d.target, 0, moved);
    update({ cities: next });
  };

  const rowShift = (index: number) => {
    if (!drag || index === drag.index) return 0;
    const pitch = drag.pitches[index] ?? 74;
    if (drag.index < drag.target && index > drag.index && index <= drag.target) return -pitch;
    if (drag.index > drag.target && index >= drag.target && index < drag.index) return pitch;
    return 0;
  };

  // ---- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "t" || e.key === "T") toggleHour24();
      else if (e.key === "g" || e.key === "G") setGlobeMode((v) => !v);
      else if (e.key === "Escape") {
        if (globeMode) setGlobeMode(false);
        else if (picked) setPicked(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Elsewhen's own caption: "It's 22:51 here in Singapore".
  const homeLabel = settings.cities[0]?.label ?? labelForZone(here);
  const hereLine = `It's ${formatTime(local, hour24)} here in ${homeLabel}`;

  const list = (
    <div className="list">
      {settings.cities.map((city: City, i) => (
        <CityRow
          key={city.id}
          city={city}
          index={i}
          now={now}
          localOffset={localOffset}
          hour24={hour24}
          offsetMode={settings.offsetMode}
          locale={locale}
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
          onPick={() => pickCity(city.id)}
          onToggleHour24={toggleHour24}
          onToggleOffset={toggleOffset}
          onRemove={settings.cities.length > 1 ? () => removeCity(city.id) : undefined}
          onDragStart={beginDrag}
          onDragMove={moveDrag}
          onDragEnd={endDrag}
          registerRow={registerRow}
        />
      ))}
      <CitySearch
        existing={settings.cities}
        placeholder="Add a city"
        fg={theme.foreground}
        accent={theme.accent}
        rounded={rounded}
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
              zoom={globeOn ? 1 : 0}
              onClick={() => (wide ? setPicked(null) : setGlobeMode((v) => !v))}
            />
            <span className="hero-word">Clock</span>
          </div>
        </header>

        <div className="stage" data-globe={globeMode}>
          <div className="stage-list" aria-hidden={globeMode && !wide}>
            {list}
          </div>
          <div className="stage-globe" aria-hidden={!globeOn}>
            <Globe
              now={now}
              tracked={settings.cities}
              homeZone={here}
              hour24={hour24}
              bg={theme.background}
              fg={theme.foreground}
              accent={theme.accent}
              daylightMarker="#E5C736"
              focusLon={focus.lon}
              focusLat={focus.lat}
              focusShown={!!picked || !!globeCity}
              zoom={globeOn ? 1 : 0}
              active={globeOn}
              reducedMotion={reducedMotion}
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
            title="Toggle 12/24-hour time (T)"
          >
            {hour24 ? "24h" : "12h"}
          </button>
          <button
            type="button"
            className="bar-button"
            onClick={toggleOffset}
            title="Row offsets: distance from here, or the zone's own UTC offset"
          >
            {settings.offsetMode === "utc" ? "UTC" : "from here"}
          </button>
          <span className="bar-spacer" />
          <span className="bar-count">
            {settings.cities.length} of {CITIES.length}
          </span>
          <ThemePicker
            theme={theme}
            rounded={rounded}
            onTheme={(id) => update({ theme: id })}
            onRounded={(v) => update({ rounded: v })}
          />
        </footer>
      </main>
    </div>
  );
}
